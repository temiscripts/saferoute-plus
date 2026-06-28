"""
Flask microservice wrapping motion-anomaly prediction.

POST /predict
  Content-Type: application/json
  Body: {"samples": [[x, y, z], ...]}
  Returns: {"label": "anomaly"|"normal", "confidence": 0.91, "windows_scored": 3, "anomaly_windows": 2, "per_window_proba": [...]}

GET /health
  Returns: {"ok": true}
"""

import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from predict import predict_array

app = Flask(__name__)
CORS(app)

THRESHOLD = float(os.environ.get("ANOMALY_THRESHOLD", "0.5"))


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/predict")
def predict_endpoint():
    data = request.get_json(silent=True)
    if not data or "samples" not in data:
        return jsonify({"error": "Body must be JSON with a 'samples' key: [[x,y,z], ...]"}), 400

    try:
        samples = np.array(data["samples"], dtype=np.float32)
    except Exception:
        return jsonify({"error": "Invalid samples — must be a 2D array of [x, y, z] numbers"}), 400

    if samples.ndim != 2 or samples.shape[1] != 3:
        return jsonify({"error": "samples must have shape (N, 3)"}), 400

    try:
        result = predict_array(samples, threshold=THRESHOLD)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {e}"}), 500

    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or 5002)
    app.run(host="0.0.0.0", port=port)
