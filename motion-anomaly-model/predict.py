"""
Inference script — classify a window of accelerometer data as normal or anomaly.

Input: JSON with a list of [x, y, z] samples (at least WINDOW_SIZE long).
       Either pass a file path or pipe JSON to stdin.

Usage:
    # From a JSON file
    python predict.py --file samples.json

    # From stdin
    echo '{"samples": [[0.1, 9.8, 0.2], ...]}' | python predict.py

    # From a CSV with columns x, y, z
    python predict.py --csv trace.csv

Output (JSON to stdout):
    {"label": "anomaly", "confidence": 0.91, "windows_scored": 3, "anomaly_windows": 2}

The escalation engine uses this as one signal among several — motion alone
does not auto-trigger SOS. It raises the urgency level so the deadman window
shrinks from 120s to 30s.
"""

import sys
import json
import argparse
import numpy as np
import pandas as pd
import joblib
from pathlib import Path

MODELS_DIR  = Path(__file__).parent / "models"
MODEL_PATH  = MODELS_DIR / "motion_classifier.joblib"
META_PATH   = MODELS_DIR / "meta.json"


def load_meta():
    with open(META_PATH) as f:
        return json.load(f)


def window_features(window: np.ndarray) -> np.ndarray:
    """Same feature extraction as used in train.py — must stay in sync."""
    mag  = np.linalg.norm(window, axis=1)
    jerk = np.diff(mag)
    features = []
    for i in range(3):
        col = window[:, i]
        features += [col.mean(), col.std(), col.min(), col.max()]
    features += [np.sqrt(np.mean(mag ** 2)), np.sqrt(np.mean(jerk ** 2))]
    return np.array(features)


def sliding_windows(arr: np.ndarray, window_size: int, step: int):
    for start in range(0, len(arr) - window_size + 1, step):
        yield arr[start: start + window_size]


def predict_array(samples: np.ndarray, threshold: float = 0.5) -> dict:
    """
    Score a (N x 3) float array of accelerometer samples.
    Returns a dict with overall label, confidence, and per-window counts.
    """
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"No trained model found at {MODEL_PATH}. "
            "Run train.py first."
        )

    meta         = load_meta()
    model        = joblib.load(MODEL_PATH)
    window_size  = meta["window_size"]
    step_size    = meta["step_size"]

    windows = list(sliding_windows(samples, window_size, step_size))
    if not windows:
        return {
            "label":           "normal",
            "confidence":      0.0,
            "windows_scored":  0,
            "anomaly_windows": 0,
            "note":            f"Too few samples for a {window_size}-sample window.",
        }

    feature_matrix = np.array([window_features(w) for w in windows])
    probas         = model.predict_proba(feature_matrix)[:, 1]   # P(anomaly)

    anomaly_windows = int((probas >= threshold).sum())
    # Overall anomaly confidence = fraction of anomaly windows
    overall_conf = float(probas.max())   # highest single-window confidence
    label = "anomaly" if anomaly_windows > 0 else "normal"

    return {
        "label":           label,
        "confidence":      round(overall_conf, 4),
        "windows_scored":  len(windows),
        "anomaly_windows": anomaly_windows,
        "per_window_proba": [round(float(p), 4) for p in probas],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify accelerometer data as normal or anomaly.")
    parser.add_argument("--file",      help="JSON file: {\"samples\": [[x,y,z], ...]}")
    parser.add_argument("--csv",       help="CSV file with columns x, y, z (no header)")
    parser.add_argument("--threshold", type=float, default=0.5,
                        help="Anomaly probability threshold (default 0.5)")
    args = parser.parse_args()

    try:
        if args.csv:
            df      = pd.read_csv(args.csv, header=None, names=["x", "y", "z"])
            samples = df.values.astype(np.float32)
        elif args.file:
            with open(args.file) as f:
                data = json.load(f)
            samples = np.array(data["samples"], dtype=np.float32)
        else:
            data    = json.load(sys.stdin)
            samples = np.array(data["samples"], dtype=np.float32)

        result = predict_array(samples, threshold=args.threshold)
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["label"] == "normal" else 1)

    except FileNotFoundError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)
    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {e}"}))
        sys.exit(2)
