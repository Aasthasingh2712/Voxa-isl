import sys
import math
import logging
import joblib
import numpy as np
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Literal

# --- Setup logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Dynamic Path Resolution ---
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Import the existing preprocessing safely
try:
    from ml.preprocessing import transform_wrist_relative_palm_normalized
except ImportError as e:
    logger.error(f"Failed to import ml.preprocessing: {e}")
    transform_wrist_relative_palm_normalized = None

MODEL_PATH = REPO_ROOT / "ml" / "models" / "voxa_digits_pilot_rf.joblib"

# --- A-Z fingerspelling model (SignSpeak, two-hand, 126 features) ---
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
from az_inference import AZModel, predict_hands  # noqa: E402

AZ = AZModel(
    REPO_ROOT / "ml" / "models" / "signspeak_model.joblib",
    REPO_ROOT / "ml" / "models" / "signspeak_az_metadata.json",
)

# Global state
class AppState:
    model = None
    model_loaded = False
    load_attempts = 0 # To track if we tried multiple times (should only be 1)

# --- Pydantic Models ---
class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float

    @field_validator('x', 'y', 'z')
    @classmethod
    def check_finite(cls, v):
        if math.isnan(v) or math.isinf(v):
            raise ValueError('Coordinate must be finite')
        return v

class PredictRequest(BaseModel):
    landmarks: List[LandmarkPoint] = Field(..., description="Exactly 21 MediaPipe landmarks")

    @field_validator('landmarks')
    @classmethod
    def check_landmark_count(cls, v):
        if len(v) != 21:
            raise ValueError(f'Exactly 21 landmarks required, received {len(v)}')
        return v

class HandPayload(BaseModel):
    handedness: Literal["Left", "Right"]
    landmarks: List[LandmarkPoint] = Field(..., description="Exactly 21 MediaPipe landmarks")

    @field_validator('landmarks')
    @classmethod
    def check_landmark_count(cls, v):
        if len(v) != 21:
            raise ValueError(f'Exactly 21 landmarks required, received {len(v)}')
        return v

class PredictAZRequest(BaseModel):
    hands: List[HandPayload] = Field(..., min_length=1, max_length=2)

# --- Lifespan Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attempt to load the model ONCE
    AppState.load_attempts += 1
    logger.info(f"Attempting to load Phase 1 Demo Model (Attempt #{AppState.load_attempts})...")
    try:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

        loaded_model = joblib.load(MODEL_PATH)

        # Validation checks
        if not hasattr(loaded_model, "predict"):
            raise ValueError("Model does not expose predict()")
        if not hasattr(loaded_model, "predict_proba"):
            raise ValueError("Model does not expose predict_proba()")
        if not hasattr(loaded_model, "classes_"):
            raise ValueError("Model does not expose classes_")

        classes = loaded_model.classes_
        expected_classes = np.arange(10)
        classes_int = np.array([int(c) for c in classes])
        if not np.array_equal(np.sort(classes_int), expected_classes):
             raise ValueError(f"Model classes_ do not correspond to digits 0-9. Found: {classes}")

        AppState.model = loaded_model
        AppState.model_loaded = True
        logger.info("Model loaded and validated successfully.")
    except Exception as e:
        AppState.model = None
        AppState.model_loaded = False
        logger.error(f"Failed to load model: {e}")

    # A-Z model is independent: the API stays up even if either model fails to load.
    AZ.load()

    yield
    AppState.model = None

# --- Application Setup ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoints ---
@app.get("/")
def home():
    return {"message": "ISL Translator Backend Running"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        # Frontend treats model_loaded as "ready": true if either model is usable.
        "model_loaded": AppState.model_loaded or AZ.loaded,
        "az_model_loaded": AZ.loaded,
        "digits_model_loaded": AppState.model_loaded,
        "load_attempts": AppState.load_attempts
    }

@app.post("/predict")
def predict(request: PredictRequest):
    if not AppState.model_loaded or AppState.model is None or transform_wrist_relative_palm_normalized is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is unavailable for prediction."
        )

    raw_coords = []
    for lm in request.landmarks:
        raw_coords.extend([lm.x, lm.y, lm.z])

    raw_landmarks = np.array([raw_coords], dtype=np.float64) # Shape (1, 63)

    try:
        processed_landmarks = transform_wrist_relative_palm_normalized(raw_landmarks)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if processed_landmarks.shape != (1, 63):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Preprocessing resulted in invalid shape.")

    if not np.isfinite(processed_landmarks).all():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Preprocessing produced non-finite values.")

    try:
        proba_array = AppState.model.predict_proba(processed_landmarks)[0] # Shape (10,)
        max_idx = np.argmax(proba_array)
        prediction_class = int(AppState.model.classes_[max_idx])
        confidence = float(proba_array[max_idx])

        return {
            "prediction": prediction_class,
            "confidence": confidence
        }
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Prediction failed internally.")


@app.post("/predict-az")
def predict_az(request: PredictAZRequest):
    """A-Z fingerspelling from one or two hands (each tagged Left/Right)."""
    if not AZ.loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A-Z model is unavailable for prediction."
        )

    hands = [
        (h.handedness, [(p.x, p.y, p.z) for p in h.landmarks])
        for h in request.hands
    ]
    try:
        return predict_hands(AZ, hands)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"A-Z prediction failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Prediction failed internally.")