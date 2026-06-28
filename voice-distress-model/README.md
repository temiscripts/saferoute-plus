# voice-distress-model

Passive voice distress classifier — MFCC features + SVM, trained on RAVDESS.

**Owner:** ML Person #1.
**Status:** Code ready. Needs dataset download + training run before Demo Day.

> Per repo policy, this folder's contents are **not** pushed to GitHub by the project lead. The owner pushes their own work under their own git identity.

## What it does

Classifies a short WAV clip as `calm` or `distress`. The app captures audio in the browser (Web Audio API), sends the clip to a local inference endpoint, and uses the result as one of several inputs to raise or lower the SOS urgency level.

Audio is **never** stored or sent to any server. Only the binary label travels to the escalation engine.

## Files

| File | Purpose |
|---|---|
| `train.py` | Download RAVDESS, extract MFCCs, train SVM, save to `models/` |
| `predict.py` | Classify a WAV file; outputs JSON to stdout |
| `requirements.txt` | Python dependencies |

## Setup

```bash
cd voice-distress-model
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Training

```bash
python train.py
```

Downloads RAVDESS from Hugging Face automatically (~1 GB, first run only).
Saves model to `models/voice_classifier.joblib` and metadata to `models/meta.json`.

**Expected output (after training):**
- F1 mean across 5-fold CV: typically 0.78–0.88 on binary calm/distress
- Training time: < 2 minutes on CPU

## Inference

```bash
python predict.py path/to/clip.wav
# {"label": "distress", "confidence": 0.87, "threshold_used": 0.5, ...}

python predict.py path/to/clip.wav --threshold 0.65
```

Exit code: `0` = calm, `1` = distress, `2` = error.

## How it works

1. **Dataset:** RAVDESS — 24 actors, speech + song, 8 emotions at 2 intensity levels
2. **Label mapping:** `angry (05)` + `fearful (06)` → distress; `neutral (01)` + `calm (02)` → calm; other emotions discarded
3. **Features:** 40 MFCC coefficients, mean + std over time → 80-dimensional vector per clip
4. **Model:** StandardScaler + SVM (RBF kernel, `C=1.0`, `gamma=scale`, balanced class weights)

### Why MFCCs?
MFCCs capture the spectral envelope of speech. Distress and fear produce distinct vocal tract shapes — higher tension, raised pitch — that show up as consistent MFCC deviations vs. calm speech. They're also fast to compute and well-understood.

### Why SVM-RBF?
Works well on small-to-medium high-dimensional datasets. Margin maximisation reduces overfitting. Trains in seconds.

## Known limitations

- RAVDESS is acted speech, not real distress — expect some drop in real-world accuracy
- Performance degrades in noisy environments (bus, crowd)
- The debounce window in the app (require 2 of 3 consecutive clips to flag) reduces false positives

## Demo Day talking point (for the owner)

> "It listens passively on the phone, but nothing leaves the phone. The model only ever sends a single bit — 'distress detected, yes or no' — to the rest of the app. No recordings, no transcripts, no cloud. The model itself was trained on a public research dataset of emotional speech, and I can show you exactly how the features are extracted."

## Owner to-do before Demo Day

1. Run `python train.py` and confirm F1 > 0.75
2. Document the exact accuracy numbers in this README under an "Accuracy" section
3. Test `predict.py` against the demo clips in `../seed-data/voice-clips/`
4. Note any failure modes you observed
