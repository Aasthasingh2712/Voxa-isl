"""
train_pilot.py - Pilot Machine Learning Experiment Pipeline for VOXA ISL Recognition.

STATUS: PILOT EXPERIMENT ONLY - NOT FINAL RESEARCH RESULT
Signer: single signer (signer01)
Vocabulary: ISL Digits 0-9 (10 classes)
Split: Stratified 80/20 train/test (same-signer)

Evaluates 3 Landmark Representations:
- RAW (63 features)
- WRIST_RELATIVE (63 features)
- WRIST_RELATIVE_PALM_NORMALIZED (63 features)

Across 4 Untuned Baseline Classifiers:
- kNN (k=5, Euclidean, StandardScaler)
- SVM (RBF, C=1.0, gamma='scale', StandardScaler)
- Random Forest (100 trees, unscaled)
- MLP (128x64, ReLU, Adam, max_iter=500, early_stopping, StandardScaler)

Total: 12 experimental configurations evaluated on an identical stratified split.
"""

import argparse
import datetime
import json
import os
import sys
import time
import warnings
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Prevent joblib core count warning on Windows
os.environ["LOKY_MAX_CPU_COUNT"] = str(os.cpu_count() or 4)

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

# Ensure parent directory is in sys.path regardless of execution cwd
CURRENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Local imports
try:
    from ml.preprocessing import (
        TOTAL_LANDMARK_FEATURES,
        extract_raw_landmarks,
        get_landmark_feature_names,
        transform_representation,
    )
except ImportError:
    from preprocessing import (
        TOTAL_LANDMARK_FEATURES,
        extract_raw_landmarks,
        get_landmark_feature_names,
        transform_representation,
    )


LIMITATIONS = [
    "Single signer only (signer01) - no signer-independent evaluation.",
    "Single collection session - environmental and setup conditions are fixed.",
    "Same-signer train/test split - test samples may share high correlation with train samples.",
    "Small sample size (221 total samples, ~22 per class, ~4-5 test samples per class).",
    "Mixed handedness (Left and Right hands used without experimental balance).",
    "Potential temporal auto-correlation between consecutive samples collected in sequence.",
    "Untuned baseline hyperparameters (default/standard configurations).",
    "Monocular MediaPipe depth (z) coordinate is relative and inherently noisier than x/y.",
    "Pipeline validation pilot only - metrics must NOT be claimed as publication-grade accuracy.",
]

DIGIT_CLASSES_INT = list(range(10))
DIGIT_CLASSES_STR = [str(i) for i in range(10)]


def run_data_quality_audit(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Perform an automated data-quality audit on the pilot dataset.
    Returns structured audit metrics dictionary without mutating the data.
    """
    landmark_cols = get_landmark_feature_names()
    x_cols = [f"x{i}" for i in range(21)]
    y_cols = [f"y{i}" for i in range(21)]
    z_cols = [f"z{i}" for i in range(21)]

    # 1. Dataset shapes
    total_samples = int(len(df))
    total_columns = int(len(df.columns))

    # 2. Distributions
    class_dist = {str(k): int(v) for k, v in df["label"].astype(str).value_counts().sort_index().items()}
    signer_dist = {str(k): int(v) for k, v in df["signer_id"].value_counts().items()}
    handedness_dist = {str(k): int(v) for k, v in df["handedness"].value_counts().items()}

    # 3. Missing values
    missing_by_col = {col: int(cnt) for col, cnt in df.isnull().sum().items() if cnt > 0}

    # 4. Duplicate checks
    duplicate_sample_ids = int(df["sample_id"].duplicated().sum())
    duplicate_feature_rows = int(df[landmark_cols].duplicated().sum())

    # 5. Coordinate checks
    raw_landmarks = df[landmark_cols].to_numpy(dtype=np.float64)
    nan_values_total = int(np.isnan(raw_landmarks).sum())
    inf_values_total = int(np.isinf(raw_landmarks).sum())

    # Coordinate boundaries
    x_matrix = df[x_cols].to_numpy(dtype=np.float64)
    y_matrix = df[y_cols].to_numpy(dtype=np.float64)
    z_matrix = df[z_cols].to_numpy(dtype=np.float64)

    samples_x_lt_0 = int(np.any(x_matrix < 0.0, axis=1).sum())
    samples_x_gt_1 = int(np.any(x_matrix > 1.0, axis=1).sum())
    samples_y_lt_0 = int(np.any(y_matrix < 0.0, axis=1).sum())
    samples_y_gt_1 = int(np.any(y_matrix > 1.0, axis=1).sum())

    out_of_frame_indices = np.where(
        np.any(x_matrix < 0.0, axis=1)
        | np.any(x_matrix > 1.0, axis=1)
        | np.any(y_matrix < 0.0, axis=1)
        | np.any(y_matrix > 1.0, axis=1)
    )[0].tolist()

    out_of_frame_sample_ids = df.iloc[out_of_frame_indices]["sample_id"].tolist()

    audit_report = {
        "total_samples": total_samples,
        "total_columns": total_columns,
        "landmark_feature_count": len(landmark_cols),
        "class_distribution": class_dist,
        "signer_distribution": signer_dist,
        "handedness_distribution": handedness_dist,
        "missing_values_by_column": missing_by_col,
        "duplicate_sample_id_count": duplicate_sample_ids,
        "exact_duplicate_feature_rows": duplicate_feature_rows,
        "nan_landmark_values_count": nan_values_total,
        "infinite_landmark_values_count": inf_values_total,
        "coordinate_boundaries": {
            "samples_with_x_lt_0": samples_x_lt_0,
            "samples_with_x_gt_1": samples_x_gt_1,
            "samples_with_y_lt_0": samples_y_lt_0,
            "samples_with_y_gt_1": samples_y_gt_1,
            "total_out_of_normalized_unit_bounds": len(out_of_frame_indices),
            "out_of_bounds_sample_ids": out_of_frame_sample_ids,
        },
        "x_range": [float(np.min(x_matrix)), float(np.max(x_matrix))],
        "y_range": [float(np.min(y_matrix)), float(np.max(y_matrix))],
        "z_range": [float(np.min(z_matrix)), float(np.max(z_matrix))],
    }

    # Strict check: fail if NaN or Inf makes training impossible
    if nan_values_total > 0 or inf_values_total > 0:
        raise ValueError(
            f"Fatal: Dataset contains {nan_values_total} NaNs and {inf_values_total} Infs. Cannot proceed with ML pipeline."
        )

    return audit_report


def build_models(random_state: int = 42) -> Dict[str, Pipeline]:
    """
    Build scikit-learn pipelines for the 4 untuned baseline classifiers.
    StandardScaler is fitted ONLY on training data for kNN, SVM, and MLP.
    Random Forest operates directly on unscaled features.
    """
    models = {
        "kNN": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", KNeighborsClassifier(n_neighbors=5, weights="uniform", metric="euclidean")),
        ]),
        "SVM": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", SVC(kernel="rbf", C=1.0, gamma="scale", random_state=random_state)),
        ]),
        "Random_Forest": Pipeline([
            ("classifier", RandomForestClassifier(n_estimators=100, max_depth=None, random_state=random_state)),
        ]),
        "MLP": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", MLPClassifier(
                hidden_layer_sizes=(128, 64),
                activation="relu",
                solver="adam",
                max_iter=500,
                early_stopping=True,
                random_state=random_state,
            )),
        ]),
    }
    return models


def plot_confusion_matrix(
    cm: np.ndarray,
    labels: List[str],
    representation: str,
    model_name: str,
    accuracy: float,
    output_path: Path,
) -> None:
    """Save a clean, publication-ready confusion matrix visualization."""
    fig, ax = plt.subplots(figsize=(7, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=labels,
        yticklabels=labels,
        cbar=True,
        ax=ax,
    )
    ax.set_title(
        f"Pilot ISL Confusion Matrix\n{representation} + {model_name} (Acc: {accuracy:.1%})\n"
        "[Pilot / Same-Signer Validation Only]",
        fontsize=11,
        pad=12,
    )
    ax.set_xlabel("Predicted Digit", fontsize=10, labelpad=8)
    ax.set_ylabel("True Digit", fontsize=10, labelpad=8)
    plt.tight_layout()
    plt.savefig(output_path, dpi=200)
    plt.close(fig)


def run_experiment(
    data_path: str,
    output_base_dir: str = "ml/outputs",
    random_state: int = 42,
    test_size: float = 0.20,
) -> Dict[str, Any]:
    """Execute the full reproducible 12-configuration pilot experiment."""
    data_path = Path(data_path)
    if not data_path.is_file():
        raise FileNotFoundError(f"Pilot dataset not found: {data_path}")

    # Create timestamped run folder
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = Path(output_base_dir) / f"pilot_{timestamp_str}"
    plots_dir = run_dir / "confusion_matrices"
    reports_dir = run_dir / "classification_reports"
    run_dir.mkdir(parents=True, exist_ok=False)
    plots_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== VOXA ISL Pilot Experiment Pipeline ===")
    print(f"Dataset: {data_path}")
    print(f"Output directory: {run_dir}")

    # 1. Load CSV
    df = pd.read_csv(data_path)
    sample_ids = df["sample_id"].to_numpy()
    
    # Store labels as integers for compatibility with all sklearn estimators (including MLP early_stopping)
    labels = df["label"].astype(int).to_numpy()

    # 2. Data Quality Audit
    print("\n--- [Step 1/5] Running Data Quality Audit ---")
    audit_report = run_data_quality_audit(df)
    audit_json_path = run_dir / "data_quality_report.json"
    with open(audit_json_path, "w", encoding="utf-8") as f:
        json.dump(audit_report, f, indent=2)
    print(f"Audit completed: {audit_report['total_samples']} samples, {audit_report['landmark_feature_count']} features.")
    print(f"Handedness: {audit_report['handedness_distribution']}")
    print(f"Out-of-unit-boundary coordinates [0, 1]: {audit_report['coordinate_boundaries']['total_out_of_normalized_unit_bounds']} sample(s)")

    # 3. Stratified Split (Fixed once for all experiments)
    print("\n--- [Step 2/5] Creating Stratified 80/20 Split ---")
    all_indices = np.arange(len(df))
    train_idx, test_idx = train_test_split(
        all_indices,
        test_size=test_size,
        stratify=labels,
        random_state=random_state,
    )
    # Save split indices for exact reproducibility
    split_indices_path = run_dir / "split_indices.npz"
    np.savez_compressed(
        split_indices_path,
        train_indices=train_idx,
        test_indices=test_idx,
        random_state=random_state,
        test_size=test_size,
    )
    print(f"Split completed: Train={len(train_idx)} ({len(train_idx)/len(df):.1%}), Test={len(test_idx)} ({len(test_idx)/len(df):.1%})")

    y_train = labels[train_idx]
    y_test = labels[test_idx]

    # Check test set class counts
    test_class_counts = {str(k): int(v) for k, v in pd.Series(y_test).value_counts().sort_index().items()}
    print(f"Test class distribution: {test_class_counts}")

    # 4. Extract Raw Landmarks
    raw_landmarks = extract_raw_landmarks(df)

    # 5. Representations
    representations = ["RAW", "WRIST_RELATIVE", "WRIST_RELATIVE_PALM_NORMALIZED"]

    # 6. Run 12 Experiments
    print("\n--- [Step 3/5] Executing 12 Experimental Configurations ---")
    results_records = []
    confusion_matrices_dict = {}
    classification_reports_dict = {}
    convergence_warnings = []

    for rep in representations:
        print(f"\n>> Transforming representation: {rep}")
        X_rep = transform_representation(rep, raw_landmarks, sample_ids=sample_ids)
        X_train = X_rep[train_idx]
        X_test = X_rep[test_idx]

        models = build_models(random_state=random_state)

        for model_name, pipeline in models.items():
            exp_id = f"{rep}__{model_name}"
            print(f"  Training [{exp_id}]...", end="", flush=True)

            # Train with convergence monitoring
            with warnings.catch_warnings(record=True) as caught_warnings:
                warnings.simplefilter("always")
                t0_train = time.perf_counter()
                pipeline.fit(X_train, y_train)
                t_train = time.perf_counter() - t0_train

                # Capture any warnings
                for w in caught_warnings:
                    msg = f"[{exp_id}] {w.category.__name__}: {w.message}"
                    convergence_warnings.append(msg)

            # Predict
            t0_test = time.perf_counter()
            y_pred = pipeline.predict(X_test)
            t_test = time.perf_counter() - t0_test
            t_per_sample_ms = (t_test / len(X_test)) * 1000.0

            # Calculate metrics
            acc = float(accuracy_score(y_test, y_pred))
            prec = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
            rec = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
            f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))

            cm = confusion_matrix(y_test, y_pred, labels=DIGIT_CLASSES_INT)
            cls_report = classification_report(
                y_test,
                y_pred,
                labels=DIGIT_CLASSES_INT,
                target_names=DIGIT_CLASSES_STR,
                output_dict=True,
                zero_division=0,
            )

            # Store summary record
            record = {
                "representation": rep,
                "model": model_name,
                "accuracy": round(acc, 4),
                "macro_precision": round(prec, 4),
                "macro_recall": round(rec, 4),
                "macro_f1": round(f1, 4),
                "train_time_sec": round(t_train, 5),
                "test_time_sec": round(t_test, 5),
                "test_time_per_sample_ms": round(t_per_sample_ms, 3),
            }
            results_records.append(record)
            confusion_matrices_dict[exp_id] = cm.tolist()
            classification_reports_dict[exp_id] = cls_report

            # Save confusion matrix plot
            cm_plot_path = plots_dir / f"cm_{exp_id}.png"
            plot_confusion_matrix(cm, DIGIT_CLASSES_STR, rep, model_name, acc, cm_plot_path)

            # Save classification report json
            report_path = reports_dir / f"report_{exp_id}.json"
            with open(report_path, "w", encoding="utf-8") as f:
                json.dump(cls_report, f, indent=2)

            print(f" Done! Acc: {acc:.1%}, F1: {f1:.1%}, Train: {t_train:.3f}s")

    # 7. Save results summary CSV
    print("\n--- [Step 4/5] Saving Results and Configurations ---")
    results_df = pd.DataFrame(results_records)
    results_csv_path = run_dir / "results_summary.csv"
    results_df.to_csv(results_csv_path, index=False)
    print(f"Results summary written to: {results_csv_path}")

    # 8. Save run config with limitations
    run_config = {
        "timestamp": timestamp_str,
        "status": "PILOT_VALIDATION_ONLY",
        "notice": "PILOT / SAME-SIGNER RESULT - NOT FINAL RESEARCH RESULT",
        "dataset_path": str(data_path),
        "total_samples": len(df),
        "classes": DIGIT_CLASSES_STR,
        "representations": representations,
        "models": list(models.keys()),
        "hyperparameters": {
            "kNN": {"n_neighbors": 5, "weights": "uniform", "metric": "euclidean", "scaler": "StandardScaler"},
            "SVM": {"kernel": "rbf", "C": 1.0, "gamma": "scale", "random_state": random_state, "scaler": "StandardScaler"},
            "Random_Forest": {"n_estimators": 100, "max_depth": None, "random_state": random_state, "scaler": "None"},
            "MLP": {
                "hidden_layer_sizes": [128, 64],
                "activation": "relu",
                "solver": "adam",
                "max_iter": 500,
                "early_stopping": True,
                "random_state": random_state,
                "scaler": "StandardScaler",
            },
        },
        "split": {
            "strategy": "Stratified train_test_split",
            "test_size": test_size,
            "random_state": random_state,
            "train_samples": len(train_idx),
            "test_samples": len(test_idx),
        },
        "convergence_warnings": convergence_warnings,
        "limitations": LIMITATIONS,
    }

    config_json_path = run_dir / "run_config.json"
    with open(config_json_path, "w", encoding="utf-8") as f:
        json.dump(run_config, f, indent=2)

    print("\n--- [Step 5/5] Pipeline Execution Completed Successfully ---")
    print(f"All artifacts saved under: {run_dir}\n")

    return {
        "run_dir": str(run_dir),
        "results_df": results_df,
        "audit_report": audit_report,
        "train_samples": len(train_idx),
        "test_samples": len(test_idx),
        "test_class_counts": test_class_counts,
        "confusion_matrices": confusion_matrices_dict,
        "classification_reports": classification_reports_dict,
        "convergence_warnings": convergence_warnings,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run VOXA ISL Pilot Experiment Pipeline.")
    parser.add_argument(
        "--data",
        type=str,
        default="ml/data/pilot/isl_digit_landmarks_1790158569736.csv",
        help="Path to pilot CSV dataset",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="ml/outputs",
        help="Directory where experiment outputs will be stored",
    )
    args = parser.parse_args()

    run_experiment(data_path=args.data, output_base_dir=args.output_dir)
