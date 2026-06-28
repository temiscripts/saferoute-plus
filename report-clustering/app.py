"""
Flask microservice wrapping report clustering.

GET /clusters?api=<backend_url>&eps=0.40&min_samples=2
  Fetches reports from <backend_url>/reports, runs DBSCAN clustering, returns summaries.

POST /clusters
  Body: {"reports": [...], "eps": 0.40, "min_samples": 2}
  Runs clustering on the provided report list directly.

GET /health
  Returns: {"ok": true}
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from cluster import fetch_reports, load_local_reports, run, DEFAULT_EPS, MIN_SAMPLES

app = Flask(__name__)
CORS(app)

BACKEND_API = os.environ.get("BACKEND_API_URL", "http://localhost:4000")
LOCAL_SEED  = os.environ.get("LOCAL_SEED_PATH", "")


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.get("/clusters")
def clusters_get():
    api_base    = request.args.get("api", BACKEND_API)
    eps         = float(request.args.get("eps",         DEFAULT_EPS))
    min_samples = int(  request.args.get("min_samples", MIN_SAMPLES))

    try:
        if LOCAL_SEED:
            reports = load_local_reports(LOCAL_SEED)
        else:
            reports = fetch_reports(api_base)
    except Exception as e:
        return jsonify({"error": f"Could not load reports: {e}"}), 502

    clusters = run(reports, eps=eps, min_samples=min_samples)
    return jsonify({"clusters": clusters, "total_reports": len(reports)})


@app.post("/clusters")
def clusters_post():
    data = request.get_json(silent=True) or {}
    reports     = data.get("reports", [])
    eps         = float(data.get("eps",         DEFAULT_EPS))
    min_samples = int(  data.get("min_samples", MIN_SAMPLES))

    if not reports:
        return jsonify({"error": "Provide 'reports' in the request body"}), 400

    try:
        clusters = run(reports, eps=eps, min_samples=min_samples)
    except Exception as e:
        return jsonify({"error": f"Clustering failed: {e}"}), 500

    return jsonify({"clusters": clusters, "total_reports": len(reports)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5003))
    app.run(host="0.0.0.0", port=port)
