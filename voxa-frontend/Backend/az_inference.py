"""A-Z two-hand fingerspelling inference (SignSpeak model).

Pure numpy/joblib on purpose: no FastAPI imports, so it can be tested on its own.

Feature format expected by the model (126 values):
    [ left hand: 21 landmarks x (x, y, z) | right hand: 21 landmarks x (x, y, z) ]
Each hand is translated so the wrist (landmark 0) is the origin and divided by the
wrist -> middle-fingertip (landmark 12) distance. A missing hand is zero padded.

Model source: https://github.com/arpita1505/SignSpeak-AI (MIT, CC0 RealSign dataset).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional, Sequence

import numpy as np
from joblib import load

logger = logging.getLogger(__name__)

LANDMARKS_PER_HAND = 21
FEATURES_PER_HAND = LANDMARKS_PER_HAND * 3  # 63
FEATURE_DIM = FEATURES_PER_HAND * 2  # 126
HAND_ORDER = ("Left", "Right")


def normalize_hand(points: Sequence[Sequence[float]]) -> np.ndarray:
    """(21, 3) landmarks -> flat (63,) wrist-centred, scale-normalised vector."""
    arr = np.asarray(points, dtype=np.float64)
    if arr.shape != (LANDMARKS_PER_HAND, 3):
        raise ValueError(f"Expected 21x3 landmarks, got {arr.shape}")
    centred = arr - arr[0]
    scale = float(np.linalg.norm(arr[12] - arr[0]))
    if scale < 1e-6:
        scale = 1.0
    return (centred / scale).flatten()


def build_features(hands: Sequence[tuple[str, Sequence[Sequence[float]]]]) -> np.ndarray:
    """Build the 126-dim vector from [(handedness, landmarks), ...]. Last duplicate wins."""
    by_label: dict[str, np.ndarray] = {}
    for label, points in hands:
        if label not in HAND_ORDER:
            raise ValueError(f"handedness must be 'Left' or 'Right', got {label!r}")
        by_label[label] = normalize_hand(points)

    features = np.zeros(FEATURE_DIM, dtype=np.float64)
    for slot, label in enumerate(HAND_ORDER):
        if label in by_label:
            features[slot * FEATURES_PER_HAND:(slot + 1) * FEATURES_PER_HAND] = by_label[label]
    return features


def swap_hand_slots(features: np.ndarray) -> np.ndarray:
    """Swap the Left/Right slots (handles webcam mirroring flipping MediaPipe's label)."""
    return np.concatenate([features[FEATURES_PER_HAND:], features[:FEATURES_PER_HAND]])


class AZModel:
    """Loads the SignSpeak pipeline and answers top-k queries."""

    def __init__(self, model_path: Path, metadata_path: Optional[Path] = None):
        self.model_path = Path(model_path)
        self.metadata_path = Path(metadata_path) if metadata_path else None
        self.model = None
        self.metadata: dict = {}
        self.threshold: float = 0.75

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def load(self) -> bool:
        try:
            if not self.model_path.exists():
                raise FileNotFoundError(f"A-Z model not found at {self.model_path}")
            model = load(self.model_path)
            for attr in ("predict_proba", "classes_"):
                if not hasattr(model, attr):
                    raise ValueError(f"A-Z model does not expose {attr}")

            if self.metadata_path and self.metadata_path.exists():
                with open(self.metadata_path, "r", encoding="utf-8") as fh:
                    self.metadata = json.load(fh)
                self.threshold = float(self.metadata.get("confidence_threshold", 0.75))
                dim = int(self.metadata.get("feature_dimension", FEATURE_DIM))
                if dim != FEATURE_DIM:
                    raise ValueError(f"Unexpected feature_dimension {dim}")

            self.model = model
            logger.info("A-Z model loaded (%d classes)", len(model.classes_))
            return True
        except Exception as exc:  # keep the API up even if this model is missing
            self.model = None
            logger.error("Failed to load A-Z model: %s", exc)
            return False

    def predict_topk(self, features: np.ndarray, k: int = 3) -> list[tuple[str, float]]:
        proba = self.model.predict_proba(features.reshape(1, -1))[0]
        order = np.argsort(proba)[::-1][:k]
        return [(str(self.model.classes_[i]), float(proba[i])) for i in order]


def predict_hands(az: AZModel, hands: Sequence[tuple[str, Sequence[Sequence[float]]]]) -> dict:
    """Predict a letter from detected hands.

    MediaPipe's Left/Right label can flip depending on webcam mirroring, so both the
    as-detected and the slot-swapped placement are scored and the more confident wins.
    """
    features = build_features(hands)
    if not np.isfinite(features).all():
        raise ValueError("Features contain non-finite values")

    as_detected = az.predict_topk(features, k=3)
    swapped = az.predict_topk(swap_hand_slots(features), k=3)

    use_swapped = bool(swapped) and swapped[0][1] > as_detected[0][1]
    chosen = swapped if use_swapped else as_detected
    label, confidence = chosen[0]

    return {
        "prediction": label,
        "confidence": confidence,
        "confident": confidence >= az.threshold,
        "threshold": az.threshold,
        "swapped": use_swapped,
        "hands_detected": len(hands),
        "top_k": [{"label": lab, "confidence": conf} for lab, conf in chosen],
    }