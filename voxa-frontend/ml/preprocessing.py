"""
preprocessing.py - Feature extraction and landmark coordinate transformations for VOXA ISL Pilot.

Research Pipeline Context:
MediaPipe Hand Landmarker outputs 21 3D landmarks (x, y, z):
- x, y are normalized image coordinates [0, 1] relative to image width and height.
- z represents landmark depth relative to the wrist (at z=0), estimated from monocular RGB.
  MediaPipe z is inherently noisier and less geometrically metric than x and y.

Transformations evaluated:
1. RAW:
   Direct 63-dimensional landmark coordinates [x0, y0, z0, ..., x20, y20, z20].
   No coordinate transformations.

2. WRIST_RELATIVE:
   Translational normalization by setting wrist (landmark 0) as coordinate origin:
   x_i' = x_i - x_0
   y_i' = y_i - y_0
   z_i' = z_i - z_0
   Landmark 0 becomes (0, 0, 0).

3. WRIST_RELATIVE_PALM_NORMALIZED:
   Translational normalization followed by palm-length scale normalization:
   scale = sqrt((x_9')^2 + (y_9')^2 + (z_9')^2)  [Landmark 9: Middle Finger MCP]
   x_i'' = x_i' / scale
   y_i'' = y_i' / scale
   z_i'' = z_i' / scale
   z is scaled by the same palm scale.
   Note: This represents palm-length normalization and does not claim to fully
   normalize all hand-size variation or morphological differences.
"""

from typing import List, Optional, Tuple, Union
import numpy as np
import pandas as pd


LANDMARK_COUNT = 21
COORDINATES_PER_LANDMARK = 3
TOTAL_LANDMARK_FEATURES = LANDMARK_COUNT * COORDINATES_PER_LANDMARK  # 63

REPRESENTATIONS = [
    "RAW",
    "WRIST_RELATIVE",
    "WRIST_RELATIVE_PALM_NORMALIZED",
]


def get_landmark_feature_names() -> List[str]:
    """Return ordered list of 63 landmark column names: x0, y0, z0, ..., x20, y20, z20."""
    cols = []
    for i in range(LANDMARK_COUNT):
        cols.extend([f"x{i}", f"y{i}", f"z{i}"])
    return cols


def extract_raw_landmarks(df: pd.DataFrame) -> np.ndarray:
    """
    Extract the 63 raw landmark columns from dataframe as a float64 numpy array.
    Shape: (N, 63).
    """
    cols = get_landmark_feature_names()
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing expected landmark columns in DataFrame: {missing}")
    return df[cols].to_numpy(dtype=np.float64, copy=True)


def transform_raw(landmarks: np.ndarray) -> np.ndarray:
    """
    Representation A: RAW coordinates.
    Returns an exact copy with no coordinate transformations.
    Input shape: (N, 63)
    Output shape: (N, 63)
    """
    if landmarks.ndim != 2 or landmarks.shape[1] != TOTAL_LANDMARK_FEATURES:
        raise ValueError(f"Expected shape (N, {TOTAL_LANDMARK_FEATURES}), got {landmarks.shape}")
    return np.array(landmarks, dtype=np.float64, copy=True)


def transform_wrist_relative(landmarks: np.ndarray) -> np.ndarray:
    """
    Representation B: WRIST_RELATIVE.
    Translates all landmarks such that the wrist (landmark 0) is at origin (0, 0, 0).
    For every landmark i in [0..20]:
        x_i' = x_i - x_0
        y_i' = y_i - y_0
        z_i' = z_i - z_0
    Input shape: (N, 63)
    Output shape: (N, 63)
    """
    if landmarks.ndim != 2 or landmarks.shape[1] != TOTAL_LANDMARK_FEATURES:
        raise ValueError(f"Expected shape (N, {TOTAL_LANDMARK_FEATURES}), got {landmarks.shape}")

    n_samples = landmarks.shape[0]
    # Reshape to (N, 21, 3)
    points = landmarks.reshape((n_samples, LANDMARK_COUNT, COORDINATES_PER_LANDMARK))

    # Wrist is landmark index 0: shape (N, 1, 3)
    wrist = points[:, 0:1, :]

    # Subtract wrist coordinates
    relative = points - wrist

    return relative.reshape((n_samples, TOTAL_LANDMARK_FEATURES))


def transform_wrist_relative_palm_normalized(
    landmarks: np.ndarray,
    sample_ids: Optional[Union[List[str], np.ndarray, pd.Series]] = None,
    min_scale: float = 1e-6,
) -> np.ndarray:
    """
    Representation C: WRIST_RELATIVE_PALM_NORMALIZED.
    Translates landmarks relative to wrist (landmark 0), then normalizes all coordinates
    (x, y, z) by the Euclidean distance from wrist (landmark 0) to middle finger MCP (landmark 9):
        scale = sqrt((x_9')^2 + (y_9')^2 + (z_9')^2)
        x_i'' = x_i' / scale
        y_i'' = y_i' / scale
        z_i'' = z_i' / scale

    Includes strict zero/near-zero scale validation to avoid silent division errors.
    Input shape: (N, 63)
    Output shape: (N, 63)
    """
    if landmarks.ndim != 2 or landmarks.shape[1] != TOTAL_LANDMARK_FEATURES:
        raise ValueError(f"Expected shape (N, {TOTAL_LANDMARK_FEATURES}), got {landmarks.shape}")

    n_samples = landmarks.shape[0]
    points = landmarks.reshape((n_samples, LANDMARK_COUNT, COORDINATES_PER_LANDMARK))

    # Wrist relative: landmark 0 is origin
    wrist = points[:, 0:1, :]
    relative = points - wrist  # shape (N, 21, 3)

    # Landmark 9 is Middle Finger MCP: shape (N, 3)
    mcp_middle = relative[:, 9, :]

    # Euclidean distance from wrist (0, 0, 0) to landmark 9: shape (N,)
    palm_scale = np.linalg.norm(mcp_middle, axis=-1)

    # Check for invalid, non-positive, or near-zero scales
    invalid_mask = (palm_scale < min_scale) | np.isnan(palm_scale) | np.isinf(palm_scale)
    if np.any(invalid_mask):
        invalid_indices = np.where(invalid_mask)[0].tolist()
        details = []
        for idx in invalid_indices:
            sid = sample_ids[idx] if sample_ids is not None else f"index_{idx}"
            details.append(f"Sample {sid} (row {idx}): palm scale = {palm_scale[idx]}")
        raise ValueError(
            f"Invalid palm scale detected in {len(invalid_indices)} sample(s):\n"
            + "\n".join(details)
            + "\nCannot perform palm scale normalization with invalid scale."
        )

    # Normalize by palm_scale: shape (N, 1, 1)
    scale_expanded = palm_scale[:, np.newaxis, np.newaxis]
    normalized = relative / scale_expanded

    return normalized.reshape((n_samples, TOTAL_LANDMARK_FEATURES))


def transform_representation(
    representation: str,
    raw_landmarks: np.ndarray,
    sample_ids: Optional[Union[List[str], np.ndarray, pd.Series]] = None,
) -> np.ndarray:
    """
    Dispatch function to transform raw landmarks into the requested representation.
    Valid representations: 'RAW', 'WRIST_RELATIVE', 'WRIST_RELATIVE_PALM_NORMALIZED'.
    """
    rep_upper = representation.upper().strip()
    if rep_upper == "RAW":
        return transform_raw(raw_landmarks)
    elif rep_upper == "WRIST_RELATIVE":
        return transform_wrist_relative(raw_landmarks)
    elif rep_upper in ("WRIST_RELATIVE_PALM_NORMALIZED", "PALM_NORMALIZED"):
        return transform_wrist_relative_palm_normalized(raw_landmarks, sample_ids=sample_ids)
    else:
        raise ValueError(
            f"Unknown representation '{representation}'. "
            f"Supported representations: {REPRESENTATIONS}"
        )
