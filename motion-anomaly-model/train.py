"""
Train a motion anomaly classifier for SafeRoute+.

Normal activity data — tries sources in order:
  1. UCI HAR raw inertial signals (archive.ics.uci.edu, ~60MB zip, no registration)
  2. Fully synthetic normal activity (instant fallback — always works)

Fall/anomaly data:
  Always synthetic (physics-based fall signatures).
  If you have MobiAct data, see swap_in_mobiact() at the bottom.

Usage:
    pip install -r requirements.txt
    python train.py            # auto-downloads UCI HAR or falls back to synthetic
    python train.py --synthetic   # skip download, use synthetic throughout
"""

import argparse
import io
import json
import math
import zipfile
import numpy as np
import pandas as pd
import joblib
import urllib.request
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
UCIHAR_URL  = "https://archive.ics.uci.edu/static/public/240/human+activity+recognition+using+smartphones.zip"
DATA_DIR    = Path("data/raw")
MODELS_DIR  = Path("models")

WINDOW_SIZE = 128   # UCI HAR native window size (50Hz × 2.56s)
STEP_SIZE   = 64    # 50% overlap

SYNTHETIC_NORMAL_PER_CLASS = 500   # windows per synthetic activity class
SYNTHETIC_FALL_WINDOWS     = 1000  # total fall windows (split across fall types)


# --------------------------------------------------------------------------
# Feature extraction — must match predict.py exactly
# --------------------------------------------------------------------------
def window_features(window: np.ndarray) -> np.ndarray:
    """
    18 statistical features from a (WINDOW_SIZE × 3) accelerometer window.
    Per-axis: mean, std, min, max. Global: magnitude RMS, jerk RMS.

    Jerk RMS is the key fall discriminator — the impact transition from
    free-fall to sudden stop produces a spike absent in any normal activity.
    """
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


# --------------------------------------------------------------------------
# UCI HAR loader
# --------------------------------------------------------------------------
def load_ucihar_signals(zf: zipfile.ZipFile, split: str) -> np.ndarray:
    """Load x/y/z body acceleration from UCI HAR zip for train or test split."""
    axes = []
    for ax in ("x", "y", "z"):
        fname = f"UCI HAR Dataset/{split}/Inertial Signals/body_acc_{ax}_{split}.txt"
        with zf.open(fname) as f:
            data = np.loadtxt(f)   # shape (N_windows, 128)
        axes.append(data)
    # axes = [x_arr, y_arr, z_arr], each (N_windows, 128)
    # Reshape to (N_windows * 128, 3) flat sequence then re-window
    n_windows = axes[0].shape[0]
    flat = np.stack(axes, axis=2).reshape(-1, 3)   # (N_windows*128, 3)
    return flat.astype(np.float32)


def try_load_ucihar() -> tuple[np.ndarray, np.ndarray] | None:
    """Download UCI HAR and extract normal-activity feature windows. Returns None on failure."""
    zip_path = DATA_DIR / "ucihar.zip"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not zip_path.exists():
        print(f"Downloading UCI HAR (~60 MB)…")
        try:
            urllib.request.urlretrieve(UCIHAR_URL, zip_path)
            print("Download complete.")
        except Exception as e:
            print(f"[WARNING] UCI HAR download failed: {e}")
            return None

    try:
        with zipfile.ZipFile(zip_path) as zf:
            arr_train = load_ucihar_signals(zf, "train")
            arr_test  = load_ucihar_signals(zf, "test")
        arr = np.vstack([arr_train, arr_test])
        X, y = [], []
        for window in sliding_windows(arr, WINDOW_SIZE, STEP_SIZE):
            X.append(window_features(window))
            y.append(0)
        print(f"UCI HAR: {len(X)} normal windows.")
        return np.array(X), np.array(y)
    except Exception as e:
        print(f"[WARNING] Could not parse UCI HAR: {e}")
        return None


# --------------------------------------------------------------------------
# Synthetic normal activity generator
# --------------------------------------------------------------------------
def make_synthetic_normal(n_per_class: int, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic accelerometer windows for 4 normal activities:
    walking, jogging, standing, sitting.

    Walking: ~1g vertical, 0.3–0.5g horizontal at ~2Hz step frequency
    Jogging: ~2g vertical, higher horizontal, ~3Hz
    Standing: near-zero horizontal, ~9.8 vertical (gravity)
    Sitting:  near-zero all axes (gravity mostly on one axis depending on orientation)
    """
    X, y = [], []
    t = np.linspace(0, WINDOW_SIZE / 50, WINDOW_SIZE)   # 50Hz

    def add(arr):
        X.append(window_features(arr))
        y.append(0)

    for _ in range(n_per_class):
        # Walking
        phase = rng.uniform(0, 2 * math.pi)
        arr = np.stack([
            rng.normal(0.3, 0.2, WINDOW_SIZE) + 0.4 * np.sin(2 * math.pi * 2.0 * t + phase),
            rng.normal(9.6, 0.5, WINDOW_SIZE) + 1.2 * np.sin(2 * math.pi * 2.0 * t + phase),
            rng.normal(0.1, 0.2, WINDOW_SIZE),
        ], axis=1).astype(np.float32)
        add(arr)

    for _ in range(n_per_class):
        # Jogging
        phase = rng.uniform(0, 2 * math.pi)
        arr = np.stack([
            rng.normal(0.5, 0.4, WINDOW_SIZE) + 1.0 * np.sin(2 * math.pi * 3.0 * t + phase),
            rng.normal(9.2, 1.2, WINDOW_SIZE) + 2.5 * np.sin(2 * math.pi * 3.0 * t + phase),
            rng.normal(0.2, 0.4, WINDOW_SIZE),
        ], axis=1).astype(np.float32)
        add(arr)

    for _ in range(n_per_class):
        # Standing
        arr = np.stack([
            rng.normal(0.0, 0.05, WINDOW_SIZE),
            rng.normal(9.8, 0.08, WINDOW_SIZE),
            rng.normal(0.0, 0.05, WINDOW_SIZE),
        ], axis=1).astype(np.float32)
        add(arr)

    for _ in range(n_per_class):
        # Sitting
        arr = np.stack([
            rng.normal(0.0, 0.04, WINDOW_SIZE),
            rng.normal(0.0, 0.04, WINDOW_SIZE),
            rng.normal(9.8, 0.08, WINDOW_SIZE),
        ], axis=1).astype(np.float32)
        add(arr)

    print(f"Synthetic normal: {len(X)} windows (4 activities × {n_per_class}).")
    return np.array(X), np.array(y)


# --------------------------------------------------------------------------
# Synthetic fall generator
# --------------------------------------------------------------------------
def generate_fall_window(fall_type: str, rng: np.random.Generator) -> np.ndarray:
    """
    3-phase synthetic fall window (WINDOW_SIZE × 3):
      Phase 1 (~20%): pre-fall walking
      Phase 2 (~20%): free-fall (near-zero g)
      Phase 3 (~10%): impact spike (8–20g)
      Phase 4 (~50%): post-impact (lying on ground)
    """
    n  = WINDOW_SIZE
    w  = np.zeros((n, 3), dtype=np.float32)
    p1 = int(n * 0.20)
    p2 = int(n * 0.40)
    p3 = int(n * 0.50)

    t  = np.linspace(0, p1 / 50, p1)
    w[:p1, 0] = rng.normal(0.2, 0.3, p1) + 0.4 * np.sin(2 * math.pi * 2 * t)
    w[:p1, 1] = rng.normal(9.5, 0.5, p1) + 0.8 * np.sin(2 * math.pi * 2 * t)
    w[:p1, 2] = rng.normal(0.1, 0.2, p1)

    w[p1:p2, :] = rng.normal(0, 0.2, (p2 - p1, 3))

    impact = rng.uniform(8, 20)
    if fall_type == "forward":
        w[p2:p3, 0] = rng.normal(impact, 1.5, p3 - p2)
        w[p2:p3, 1] = rng.normal(-3.0,  1.0, p3 - p2)
        w[p2:p3, 2] = rng.normal(2.0,   1.0, p3 - p2)
    elif fall_type == "backward":
        w[p2:p3, 0] = rng.normal(-impact, 1.5, p3 - p2)
        w[p2:p3, 1] = rng.normal(-2.0,   1.0, p3 - p2)
        w[p2:p3, 2] = rng.normal(1.0,    1.0, p3 - p2)
    else:
        w[p2:p3, 0] = rng.normal(2.0,    1.0, p3 - p2)
        w[p2:p3, 1] = rng.normal(-2.0,   1.0, p3 - p2)
        w[p2:p3, 2] = rng.normal(impact, 1.5, p3 - p2)

    w[p3:, :] = rng.normal(0, 0.8, (n - p3, 3))
    w[p3:, 1] += rng.choice([-9.5, 9.5])
    return w


def generate_synthetic_falls(n: int, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    types = ["forward", "backward", "lateral"]
    X, y  = [], []
    for i in range(n):
        w = generate_fall_window(types[i % 3], rng)
        X.append(window_features(w))
        y.append(1)
    print(f"Synthetic falls: {n} windows.")
    return np.array(X), np.array(y)


# --------------------------------------------------------------------------
# MobiAct stub (swap in when data is available)
# --------------------------------------------------------------------------
def swap_in_mobiact(data_dir: Path):
    """
    If you download MobiAct (register at https://bmi.hmu.gr), call this instead
    of the synthetic data path. Point data_dir at the 'Annotated Data' folder.
    """
    raise NotImplementedError(
        "Swap this in manually. See README for MobiAct instructions."
    )


# --------------------------------------------------------------------------
# Training
# --------------------------------------------------------------------------
def train(X: np.ndarray, y: np.ndarray) -> Pipeline:
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    RandomForestClassifier(
            n_estimators=200,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    print("5-fold cross-validation…")
    scores = cross_val_score(pipeline, X, y, cv=5, scoring="f1")
    print(f"  F1: {scores.round(3)} — mean {scores.mean():.3f} ± {scores.std():.3f}")

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    pipeline.fit(X_tr, y_tr)
    print("\nHeld-out test set:")
    print(classification_report(y_te, pipeline.predict(X_te), target_names=["normal", "anomaly"]))
    pipeline.fit(X, y)
    return pipeline


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--synthetic", action="store_true",
                        help="Skip downloads, use fully synthetic data")
    args = parser.parse_args()

    MODELS_DIR.mkdir(exist_ok=True)
    rng = np.random.default_rng(seed=42)

    ucihar_result = None if args.synthetic else try_load_ucihar()

    if ucihar_result is not None:
        X_normal, y_normal = ucihar_result
        data_source = "UCI HAR (real) + synthetic falls"
    else:
        if not args.synthetic:
            print("Falling back to fully synthetic normal activity data.")
        X_normal, y_normal = make_synthetic_normal(SYNTHETIC_NORMAL_PER_CLASS, rng)
        data_source = "fully synthetic (normal + falls)"

    X_fall, y_fall = generate_synthetic_falls(SYNTHETIC_FALL_WINDOWS, rng)

    X = np.vstack([X_normal, X_fall])
    y = np.concatenate([y_normal, y_fall])
    print(f"\nTotal: {len(X)} windows — {(y==0).sum()} normal, {(y==1).sum()} anomaly")

    model = train(X, y)

    joblib.dump(model, MODELS_DIR / "motion_classifier.joblib")
    print(f"\nSaved model to {MODELS_DIR / 'motion_classifier.joblib'}")

    meta = {
        "window_size":   WINDOW_SIZE,
        "step_size":     STEP_SIZE,
        "label_map":     {"0": "normal", "1": "anomaly"},
        "training_data": data_source,
        "note":          "Synthetic falls are physics-based. Swap in MobiAct for real-world accuracy (see README).",
    }
    with open(MODELS_DIR / "meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("Saved meta.json")
