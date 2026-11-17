import os
import json
import joblib
import datetime
import numpy as np
import pandas as pd
import sklearn
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier

import sys
CURRENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Reuse preprocessing
from ml.preprocessing import (
    get_landmark_feature_names,
    extract_raw_landmarks,
    transform_wrist_relative_palm_normalized,
    TOTAL_LANDMARK_FEATURES,
    LANDMARK_COUNT
)

def validate_data(df: pd.DataFrame):
    if df.empty:
        raise ValueError("Dataset is empty.")
    
    expected_cols = get_landmark_feature_names()
    if len(expected_cols) != TOTAL_LANDMARK_FEATURES:
        raise ValueError(f"Expected {TOTAL_LANDMARK_FEATURES} feature names from get_landmark_feature_names(), got {len(expected_cols)}")
        
    missing_cols = [c for c in expected_cols if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing expected 63 landmark columns in DataFrame: {missing_cols}")
        
    # Check for NaN and Inf in landmark columns
    raw_landmarks = df[expected_cols].to_numpy(dtype=np.float64)
    if np.isnan(raw_landmarks).any():
        raise ValueError("Dataset contains NaN values in landmark columns.")
    if np.isinf(raw_landmarks).any():
        raise ValueError("Dataset contains Infinite values in landmark columns.")
        
    # Check labels 0-9
    labels = df["label"].astype(int).unique()
    invalid_labels = [l for l in labels if l < 0 or l > 9]
    if invalid_labels:
        raise ValueError(f"Found invalid labels (must be 0-9): {invalid_labels}")

def main():
    print("=== VOXA Phase 1: Training Temporary Demo Model ===")
    
    # 1. Load Data
    data_path = CURRENT_DIR / "data" / "pilot" / "isl_digit_landmarks_1790158569736.csv"
    if not data_path.exists():
        raise FileNotFoundError(f"Dataset not found at {data_path}")
    
    df = pd.read_csv(data_path)
    
    # 2. Validate Data Before Training
    print("Validating data...")
    validate_data(df)
    
    # Extract
    raw_landmarks = extract_raw_landmarks(df)
    labels = df["label"].astype(int).to_numpy()
    
    # 3. Preprocessing
    print("Applying WRIST_RELATIVE_PALM_NORMALIZED transformation...")
    X = transform_wrist_relative_palm_normalized(raw_landmarks, sample_ids=df["sample_id"].to_numpy())
    y = labels
    
    print(f"Data shape after transformation: X={X.shape}, y={y.shape}")
    
    # 4. Model Training
    print("Training RandomForestClassifier on ALL 221 samples...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=None,
        random_state=42
    )
    
    model.fit(X, y)
    
    # 5. Save Artifacts
    models_dir = CURRENT_DIR / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = models_dir / "voxa_digits_pilot_rf.joblib"
    metadata_path = models_dir / "voxa_digits_pilot_rf_metadata.json"
    
    joblib.dump(model, model_path)
    
    # 6. Metadata
    signer_dist = {str(k): int(v) for k, v in df["signer_id"].value_counts().items()}
    handedness_dist = {str(k): int(v) for k, v in df["handedness"].value_counts().items()}
    
    metadata = {
        "model_purpose": "temporary_pipeline_demo",
        "warning": "NOT THE FINAL RESEARCH MODEL. Single-signer pilot data only. Evaluated using a highly correlated same-signer split.",
        "classes": [str(i) for i in range(10)],
        "representation": "WRIST_RELATIVE_PALM_NORMALIZED",
        "training_samples": len(df),
        "signer_count": len(signer_dist),
        "signer_ids": list(signer_dist.keys()),
        "handedness_distribution": handedness_dist,
        "sklearn_version": sklearn.__version__,
        "random_state": 42,
        "hyperparameters": {
            "n_estimators": 100,
            "max_depth": None
        },
        "feature_count": TOTAL_LANDMARK_FEATURES,
        "landmark_count": LANDMARK_COUNT,
        "feature_order": get_landmark_feature_names(),
        "palm_scale_reference": "landmark 9 relative to landmark 0",
        "dataset_filename": data_path.name,
        "training_timestamp": datetime.datetime.now().isoformat()
    }
    
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"Model saved to: {model_path} ({os.path.getsize(model_path)} bytes)")
    print(f"Metadata saved to: {metadata_path}")
    
    # 7. Save / Load Verification Smoke Test
    print("\n--- Running Serialization/Inference Smoke Test ---")
    reloaded_model = joblib.load(model_path)
    print("Model reloaded successfully.")
    
    classes = reloaded_model.classes_
    print(f"Classes in model: {classes.tolist()}")
    if not np.array_equal(classes, np.arange(10)):
        raise ValueError(f"Classes mismatch! Expected [0..9], got {classes}")
        
    # Take first sample
    test_sample = X[0:1]
    
    # predict()
    pred = reloaded_model.predict(test_sample)
    print(f"predict() result: {pred[0]}")
    
    # predict_proba()
    proba = reloaded_model.predict_proba(test_sample)
    
    if proba.shape != (1, 10):
        raise ValueError(f"predict_proba() shape mismatch! Expected (1, 10), got {proba.shape}")
        
    if not np.isfinite(proba).all():
        raise ValueError("predict_proba() returned non-finite values.")
        
    proba_sum = np.sum(proba)
    if not np.isclose(proba_sum, 1.0):
        raise ValueError(f"predict_proba() sum is not approx 1.0 (got {proba_sum})")
        
    print(f"predict_proba() result shape: {proba.shape}")
    print(f"predict_proba() probabilities finite: True")
    print(f"predict_proba() probability sum: {proba_sum}")
    print("Smoke test PASSED.")

if __name__ == "__main__":
    main()
