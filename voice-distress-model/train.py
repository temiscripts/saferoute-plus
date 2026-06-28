"""
Train a voice distress classifier on the RAVDESS dataset.

Dataset source: xbgoose/ravdess on Hugging Face (Parquet format — no FFmpeg required).
  Columns: audio {bytes, path}, emotion, actor, gender, ...

RAVDESS emotion codes:
  01=neutral  02=calm   03=happy  04=sad
  05=angry    06=fearful 07=disgust 08=surprised

Label mapping for binary classification:
  distress  = angry (5) + fearful (6)
  calm      = neutral (1) + calm (2)
  (other emotions are discarded)

Usage:
    pip install -r requirements.txt
    python train.py

Downloads ~150 MB of parquet files on first run (cached in ~/.cache/huggingface/).
Saves trained model to models/voice_classifier.joblib.
"""

import io
import json
import numpy as np
import librosa
import joblib
from pathlib import Path
from huggingface_hub import hf_hub_download
import soundfile as sf
from sklearn.svm import SVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
RAVDESS_REPO    = "xbgoose/ravdess"
PARQUET_FILES   = [
    "data/train-00000-of-00002-94d632c9f1f51bbe.parquet",
]
MODELS_DIR  = Path("models")
N_MFCC      = 40
HOP_LENGTH  = 512
N_FFT       = 1024
SAMPLE_RATE = 22050

DISTRESS_EMOTIONS = {"angry", "fearful", 5, 6}
CALM_EMOTIONS     = {"neutral", "calm", 1, 2}


# --------------------------------------------------------------------------
# Feature extraction
# --------------------------------------------------------------------------
def extract_features(audio_bytes: bytes) -> np.ndarray | None:
    """
    Decode WAV bytes → resample to 22050 Hz → extract 40 MFCCs → return mean+std (80 values).

    Why MFCCs?
    They capture the spectral envelope (vocal tract shape), which differs
    noticeably between calm speech (relaxed muscles, lower tension) and
    distressed/fearful speech (tighter formants, raised pitch, higher energy).
    """
    try:
        arr, sr = sf.read(io.BytesIO(audio_bytes))
        if arr.ndim > 1:
            arr = arr.mean(axis=1)   # stereo → mono
        if sr != SAMPLE_RATE:
            arr = librosa.resample(arr.astype(np.float32), orig_sr=sr, target_sr=SAMPLE_RATE)
        mfcc = librosa.feature.mfcc(y=arr.astype(np.float32), sr=SAMPLE_RATE,
                                      n_mfcc=N_MFCC, hop_length=HOP_LENGTH, n_fft=N_FFT)
        return np.concatenate([np.mean(mfcc, axis=1), np.std(mfcc, axis=1)])
    except Exception as e:
        print(f"  [skip] audio decode error: {e}")
        return None


# --------------------------------------------------------------------------
# Dataset loading
# --------------------------------------------------------------------------
def load_ravdess() -> tuple[np.ndarray, np.ndarray]:
    import pandas as pd

    X, y = [], []
    skipped = 0

    for filename in PARQUET_FILES:
        print(f"Downloading {filename}…")
        path = hf_hub_download(repo_id=RAVDESS_REPO, filename=filename, repo_type="dataset")
        df = pd.read_parquet(path)

        for _, row in df.iterrows():
            emotion = row["emotion"]
            try:
                emotion = int(emotion)
            except (ValueError, TypeError):
                emotion = str(emotion).lower()
            if emotion in DISTRESS_EMOTIONS:
                label = 1
            elif emotion in CALM_EMOTIONS:
                label = 0
            else:
                skipped += 1
                continue

            audio_bytes = row["audio"]["bytes"]
            features = extract_features(audio_bytes)
            if features is None:
                skipped += 1
                continue

            X.append(features)
            y.append(label)

    print(f"Loaded {len(X)} samples ({y.count(1)} distress, {y.count(0)} calm). Skipped {skipped}.")
    return np.array(X), np.array(y)


# --------------------------------------------------------------------------
# Training
# --------------------------------------------------------------------------
def train(X: np.ndarray, y: np.ndarray) -> Pipeline:
    """
    StandardScaler + SVM (RBF kernel).

    Why SVM-RBF?
    Works well on small-to-medium high-dimensional feature sets.
    Margin maximisation reduces overfitting; balanced class weights
    handle the slight class imbalance in RAVDESS.
    """
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    CalibratedClassifierCV(
                       SVC(kernel="rbf", C=1.0, gamma="scale",
                           class_weight="balanced"),
                       ensemble=False)),
    ])

    print("5-fold cross-validation…")
    cv_scores = cross_val_score(pipeline, X, y, cv=5, scoring="f1")
    print(f"  F1 scores: {cv_scores.round(3)}")
    print(f"  Mean F1:   {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2,
                                                stratify=y, random_state=42)
    pipeline.fit(X_tr, y_tr)
    print("\nHeld-out test set:")
    print(classification_report(y_te, pipeline.predict(X_te),
                                  target_names=["calm", "distress"]))

    pipeline.fit(X, y)
    return pipeline


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------
if __name__ == "__main__":
    MODELS_DIR.mkdir(exist_ok=True)

    X, y = load_ravdess()
    model = train(X, y)

    out_path = MODELS_DIR / "voice_classifier.joblib"
    joblib.dump(model, out_path)
    print(f"\nSaved model to {out_path}")

    meta = {
        "n_mfcc":            N_MFCC,
        "hop_length":        HOP_LENGTH,
        "n_fft":             N_FFT,
        "sample_rate":       SAMPLE_RATE,
        "distress_emotions": ["angry", "fearful"],
        "calm_emotions":     ["neutral", "calm"],
        "label_map":         {"0": "calm", "1": "distress"},
        "dataset":           RAVDESS_REPO,
    }
    with open(MODELS_DIR / "meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print("Saved meta.json")
