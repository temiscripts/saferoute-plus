"""
Flask microservice wrapping voice-distress prediction.

POST /predict
  Content-Type: multipart/form-data
  Field: audio (WAV file)
  Returns: {"label": "distress"|"calm", "confidence": 0.87, "threshold_used": 0.5, "probabilities": {...}}

GET /health
  Returns: {"ok": true}
"""

import os
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from predict import predict

app = Flask(__name__)
CORS(app)

THRESHOLD = float(os.environ.get("DISTRESS_THRESHOLD", "0.5"))


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/predict")
def predict_endpoint():
    if "audio" not in request.files:
        return jsonify({"error": "Missing 'audio' file field"}), 400

    audio_file = request.files["audio"]
    suffix = ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        audio_file.save(tmp_path)

    try:
        result = predict(tmp_path, threshold=THRESHOLD)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {e}"}), 500
    finally:
        os.unlink(tmp_path)

    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
