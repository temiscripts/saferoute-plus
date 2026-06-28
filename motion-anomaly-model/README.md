# motion-anomaly-model

Accelerometer-based anomaly classifier — windowed hand-crafted features + Random Forest, trained on MobiAct.

**Owner:** ML Person #2 (part A).
**Status:** Code ready. Needs MobiAct download + training run before Demo Day.

> Per repo policy, this folder's contents are **not** pushed to GitHub by the project lead. The owner pushes their own work under their own git identity.

## What it does

Classifies a short window of phone accelerometer data as `normal` (walking, standing, etc.) or `anomaly` (fall, violent motion). The app samples the device accelerometer via the browser `DeviceMotionEvent` API and sends windows to this classifier. A detected anomaly shortens the deadman check-in window from 120s to 30s, giving the user less time to miss a check-in before SOS triggers.

**Motion anomaly never auto-triggers SOS by itself** — it's one signal. The escalation engine combines it with missed check-ins and (optionally) voice distress.

## Files

| File | Purpose |
|---|---|
| `train.py` | Window MobiAct CSV data, extract features, train Random Forest, save to `models/` |
| `predict.py` | Classify a JSON/CSV accelerometer trace; outputs JSON to stdout |
| `requirements.txt` | Python dependencies |

## Dataset

**MobiAct v2.0** — phone accelerometer recordings of 57 participants: falls (FOL, FKL, BSC, SDL) and Activities of Daily Living (WAL, JOG, STD, SIT, etc.).

> **Note:** SisFall's original host is currently dead. Use MobiAct instead.

Download (free, registration required):
https://bmi.hmu.gr/the-mobifall-and-mobiact-datasets-2/

Extract so the `Annotated Data` folder is at:
```
motion-anomaly-model/data/raw/MobiAct_Dataset_v2.0/Annotated Data/
```

## Setup

```bash
cd motion-anomaly-model
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Training

```bash
python train.py
```

Saves model to `models/motion_classifier.joblib` and metadata to `models/meta.json`.

**Expected output:**
- F1 mean (5-fold CV): typically 0.88–0.95 on binary normal/anomaly
- Training time: ~5 minutes on CPU for the full dataset

## Inference

```bash
# From a JSON file
python predict.py --file accel_trace.json
# {"label": "anomaly", "confidence": 0.91, "windows_scored": 3, "anomaly_windows": 2}

# From a CSV (no header, columns: x, y, z)
python predict.py --csv trace.csv

# From stdin
echo '{"samples": [[0.1, 9.8, 0.2], [0.1, 9.9, 0.1]]}' | python predict.py
```

Exit code: `0` = normal, `1` = anomaly, `2` = error.

Minimum input length: **400 samples** (2 seconds at 200 Hz). Shorter inputs return `normal` with a note.

## How it works

1. **Windowing:** 2-second windows (400 samples at 200 Hz) with 50% overlap
2. **Features per window (18 values):** mean, std, min, max per axis (x/y/z) + magnitude RMS + jerk RMS
3. **Model:** StandardScaler + Random Forest (200 trees, balanced class weights)

### Why hand-crafted features instead of raw windows?
- Generalise better across different phone models and orientations
- Fast to compute on-device
- Interpretable — you can explain to a judge exactly which features fired

### Why jerk RMS?
Jerk (first derivative of acceleration magnitude) captures sudden changes in motion — falls produce a sharp spike that distinguishes them from vigorous normal activities like jumping.

## Known limitations

- Trained on lab falls, not real-world sudden violence — some false negatives expected
- `DeviceMotionEvent` requires HTTPS and user permission in browsers
- Low sample rates (< 50 Hz) on some phones will reduce accuracy

## Demo Day talking point (for the owner)

> "Phones already see fall patterns differently from walking patterns — we just teach a small model the difference using public fall-detection data. We deliberately keep the model simple so we can explain exactly why it fired: a sudden spike in jerk RMS, beyond what you'd see even in a sprint or jump. And because motion alone doesn't trigger SOS, a stumble on the bus doesn't falsely alert your contacts."

## Owner to-do before Demo Day

1. Download MobiAct and place in `data/raw/`
2. Run `python train.py` and confirm F1 > 0.85
3. Record actual accuracy numbers here under an "Accuracy" section
4. Test `predict.py` against the CSV samples in `../seed-data/motion-traces/`
5. Note false-positive rate on normal activity windows
