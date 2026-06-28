"""
Inference script — classify a WAV file as calm or distress.

Usage:
    python predict.py path/to/clip.wav
    python predict.py path/to/clip.wav --threshold 0.6

Output (JSON to stdout):
    {"label": "distress", "confidence": 0.87, "threshold_used": 0.5}

The app reads this output and fires a soft SOS alert if:
  label == "distress" AND confidence >= threshold
  AND the result is consistent over a 10-second debounce window.
"""

import sys
import json
import argparse
import numpy as np
import librosa
import joblib
from pathlib import Path

MODELS_DIR   = Path(__file__).parent / "models"
MODEL_PATH   = MODELS_DIR / "voice_classifier.joblib"
META_PATH    = MODELS_DIR / "meta.json"


def load_meta():
    with open(META_PATH) as f:
        return json.load(f)


def extract_features(wav_path: str, meta: dict) -> np.ndarray:
    """
    Extract the same MFCC feature vector used during training.
    Resamples to 22050 Hz and converts to mono automatically.
    """
    arr, sr = librosa.load(wav_path, sr=22050, mono=True)
    mfcc = librosa.feature.mfcc(y=arr, sr=sr,
                                  n_mfcc=meta["n_mfcc"],
                                  hop_length=meta["hop_length"],
                                  n_fft=meta["n_fft"])
    return np.concatenate([np.mean(mfcc, axis=1), np.std(mfcc, axis=1)])


def predict(wav_path: str, threshold: float = 0.5) -> dict:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"No trained model found at {MODEL_PATH}. "
            "Run train.py first."
        )

    meta  = load_meta()
    model = joblib.load(MODEL_PATH)

    features = extract_features(wav_path, meta)
    proba    = model.predict_proba([features])[0]   # [P(calm), P(distress)]

    label_map     = meta["label_map"]
    distress_prob = float(proba[1])
    label         = "distress" if distress_prob >= threshold else "calm"

    return {
        "label":           label,
        "confidence":      round(distress_prob, 4),
        "threshold_used":  threshold,
        "probabilities":   {
            label_map["0"]: round(float(proba[0]), 4),
            label_map["1"]: round(float(proba[1]), 4),
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify a WAV clip as calm or distress.")
    parser.add_argument("wav", help="Path to input WAV file")
    parser.add_argument("--threshold", type=float, default=0.5,
                        help="Minimum distress probability to classify as distress (default 0.5)")
    args = parser.parse_args()

    try:
        result = predict(args.wav, threshold=args.threshold)
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["label"] == "calm" else 1)
    except FileNotFoundError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)
    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {e}"}))
        sys.exit(2)
