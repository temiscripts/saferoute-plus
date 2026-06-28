"""
Anonymous report clustering for SafeRoute+.

Goal: Find repeat-pattern incidents (same location, similar description, similar time)
without revealing individual reports in the output.

Algorithm:
  1. Fetch reports from the backend API (GET /reports)
  2. Embed each report's description using sentence-transformers (all-MiniLM-L6-v2)
  3. Build a combined distance matrix:
       combined_dist = alpha * text_dist + beta * geo_dist + gamma * time_dist + delta * severity_dist
  4. Run DBSCAN on the combined distances
  5. For each cluster: compute centroid, dominant time-of-day, category breakdown, count,
     risk score, risk level, and severity breakdown
  6. Print a JSON summary (and optionally POST it back to the backend)

Usage:
    pip install -r requirements.txt
    python cluster.py --api http://localhost:4000

    # Adjust DBSCAN sensitivity:
    python cluster.py --api http://localhost:4000 --eps 0.35 --min-samples 2

    # Use local seed data instead of the live API:
    python cluster.py --local ../seed-data/reports.json
"""

import json
import math
import argparse
import sys
import numpy as np
import requests
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import MinMaxScaler

# --------------------------------------------------------------------------
# Config — tunable per demo run
# --------------------------------------------------------------------------
MODEL_NAME    = "all-MiniLM-L6-v2"   # fast, CPU-friendly, ~80MB download
DEFAULT_EPS   = 0.40    # DBSCAN neighbourhood radius in combined-distance space
MIN_SAMPLES   = 2       # min reports to form a cluster (low — we want to catch pairs)

# Weight for each distance component (must sum to 1)
ALPHA = 0.45   # text similarity weight
BETA  = 0.30   # geographic proximity weight
GAMMA = 0.12   # time-of-day similarity weight
DELTA = 0.13   # severity distance weight

EARTH_RADIUS_KM  = 6371.0
MAX_GEO_KM       = 5.0    # distances beyond 5km count as fully dissimilar
MAX_HOUR_DIFF    = 12     # maximum possible hour difference (circular)

# --------------------------------------------------------------------------
# Distance helpers
# --------------------------------------------------------------------------
def haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Straight-line distance between two lat/lng points in kilometres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi       = math.radians(lat2 - lat1)
    dlambda    = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def geo_distance_normalised(lat1, lng1, lat2, lng2) -> float:
    """Haversine distance clipped and scaled to [0, 1]."""
    km = haversine_km(lat1, lng1, lat2, lng2)
    return min(km / MAX_GEO_KM, 1.0)


def hour_from_ts(ts: int) -> int:
    """Extract hour-of-day (0–23) from a Unix timestamp."""
    import datetime
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).hour


def time_distance_normalised(ts1: int, ts2: int) -> float:
    """
    Circular hour difference scaled to [0, 1].
    Two incidents both at 11pm are considered close even across a date boundary.
    """
    if not ts1 or not ts2:
        return 0.5   # unknown time — treat as moderately similar
    h1, h2  = hour_from_ts(ts1), hour_from_ts(ts2)
    diff    = abs(h1 - h2)
    circular = min(diff, 24 - diff)   # circular wrap
    return circular / MAX_HOUR_DIFF


_SEVERITY_FLOAT = {
    "critical": 1.0,
    "high":     0.67,
    "moderate": 0.33,
    None:       0.5,
}


def severity_as_float(sev) -> float:
    """Encode a severity string (or None) as a float for distance computation."""
    return _SEVERITY_FLOAT.get(sev, 0.5)


def severity_distance(sev1, sev2) -> float:
    """Normalised distance [0, 1] between two severity values."""
    return abs(severity_as_float(sev1) - severity_as_float(sev2))


# --------------------------------------------------------------------------
# Data loading
# --------------------------------------------------------------------------
def fetch_reports(api_base: str) -> list:
    """Pull all reports from the live backend."""
    resp = requests.get(f"{api_base}/reports", timeout=10)
    resp.raise_for_status()
    return resp.json().get("reports", [])


def load_local_reports(path: str) -> list:
    """Load seed-data reports.json directly (for offline demo)."""
    now = int(__import__("time").time())
    raw = json.loads(Path(path).read_text())
    # Expand relative timestamps to absolute
    return [
        {
            "id":          r["id"],
            "lat":         r["lat"],
            "lng":         r["lng"],
            "description": r["description"],
            "category":    r.get("category", "other"),
            "severity":    r.get("severity", None),   # seed data may not have severity
            "occurred_at": now - r.get("days_ago", 0) * 86400 + r.get("hour", 12) * 3600,
            "created_at":  now - r.get("days_ago", 0) * 86400,
        }
        for r in raw
    ]


# --------------------------------------------------------------------------
# Embedding
# --------------------------------------------------------------------------
def embed_descriptions(reports: list) -> np.ndarray:
    """
    Encode report descriptions to dense vectors using a sentence transformer.

    Why all-MiniLM-L6-v2?
    - Only 22M parameters — runs in <1s per batch on CPU
    - Trained on diverse English text including social/informal language
    - Gives cosine distances that correlate well with semantic similarity
    """
    print(f"Loading embedding model '{MODEL_NAME}' (downloads once ~80MB)…")
    model = SentenceTransformer(MODEL_NAME)
    texts = [r.get("description", "") for r in reports]
    print(f"Embedding {len(texts)} report descriptions…")
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)
    return embeddings   # shape (N, 384), already L2-normalised


# --------------------------------------------------------------------------
# Combined distance matrix
# --------------------------------------------------------------------------
def combined_distance_matrix(reports: list, embeddings: np.ndarray) -> np.ndarray:
    """
    Build an (N x N) pairwise distance matrix combining:
      text distance (cosine), geo distance (haversine), time distance (circular hour),
      severity distance (absolute difference of encoded severity floats).

    Cosine distance from normalised vectors = 1 - dot product.
    """
    n = len(reports)
    # Text distances: cosine from normalised embeddings = 1 - dot product
    text_dist = 1.0 - (embeddings @ embeddings.T)
    text_dist = np.clip(text_dist, 0.0, 1.0)

    geo_dist      = np.zeros((n, n), dtype=np.float32)
    time_dist     = np.zeros((n, n), dtype=np.float32)
    severity_dist = np.zeros((n, n), dtype=np.float32)

    for i in range(n):
        for j in range(i + 1, n):
            g = geo_distance_normalised(
                reports[i]["lat"], reports[i]["lng"],
                reports[j]["lat"], reports[j]["lng"],
            )
            t = time_distance_normalised(
                reports[i].get("occurred_at") or reports[i].get("created_at", 0),
                reports[j].get("occurred_at") or reports[j].get("created_at", 0),
            )
            s = severity_distance(
                reports[i].get("severity"),
                reports[j].get("severity"),
            )
            geo_dist[i, j]      = geo_dist[j, i]      = g
            time_dist[i, j]     = time_dist[j, i]     = t
            severity_dist[i, j] = severity_dist[j, i] = s

    return ALPHA * text_dist + BETA * geo_dist + GAMMA * time_dist + DELTA * severity_dist


# --------------------------------------------------------------------------
# Cluster summarisation
# --------------------------------------------------------------------------
def bucket_hour(h: int) -> str:
    if 5 <= h < 12:  return "morning"
    if 12 <= h < 17: return "afternoon"
    if 17 <= h < 21: return "evening"
    return "night"


_SEVERITY_WEIGHT = {
    "critical": 3,
    "high":     2,
    "moderate": 1,
}


def summarise_cluster(cluster_reports: list) -> dict:
    """
    Build a privacy-safe summary for a cluster.
    Never includes raw descriptions or individual report IDs in the output.
    """
    lats  = [r["lat"] for r in cluster_reports]
    lngs  = [r["lng"] for r in cluster_reports]
    times = [
        hour_from_ts(r.get("occurred_at") or r.get("created_at", 0))
        for r in cluster_reports
    ]
    buckets = {}
    for h in times:
        b = bucket_hour(h)
        buckets[b] = buckets.get(b, 0) + 1

    categories = {}
    for r in cluster_reports:
        cat = r.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1

    # Severity breakdown and risk score
    severity_breakdown = {"critical": 0, "high": 0, "moderate": 0, "unknown": 0}
    weighted_sum = 0
    for r in cluster_reports:
        sev = r.get("severity")
        if sev in ("critical", "high", "moderate"):
            severity_breakdown[sev] += 1
            weighted_sum += _SEVERITY_WEIGHT[sev]
        else:
            severity_breakdown["unknown"] += 1
            weighted_sum += 1   # missing severity counts as 1

    count      = len(cluster_reports)
    risk_score = round(weighted_sum / count, 2)
    if risk_score >= 2.5:
        risk_level = "critical"
    elif risk_score >= 1.7:
        risk_level = "high"
    elif risk_score >= 1.2:
        risk_level = "moderate"
    else:
        risk_level = "low"

    dominant_time = max(buckets, key=buckets.get)
    top_category  = max(categories, key=categories.get)

    return {
        "count":              count,
        "centroid_lat":       round(sum(lats) / len(lats), 5),
        "centroid_lng":       round(sum(lngs) / len(lngs), 5),
        "dominant_time":      dominant_time,
        "top_category":       top_category,
        "category_breakdown": categories,
        "time_breakdown":     buckets,
        "risk_score":         risk_score,
        "risk_level":         risk_level,
        "severity_breakdown": severity_breakdown,
    }


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def run(reports: list, eps: float, min_samples: int) -> list:
    if len(reports) < 2:
        print("Not enough reports to cluster (need at least 2).")
        return []

    embeddings  = embed_descriptions(reports)
    dist_matrix = combined_distance_matrix(reports, embeddings)

    print(f"Running DBSCAN (eps={eps}, min_samples={min_samples})…")
    db     = DBSCAN(eps=eps, min_samples=min_samples, metric="precomputed")
    labels = db.fit_predict(dist_matrix)

    unique_labels = set(labels) - {-1}   # -1 = noise (singleton reports)
    print(f"Found {len(unique_labels)} clusters, {(labels == -1).sum()} noise points.")

    clusters = []
    for cid in sorted(unique_labels):
        members = [r for r, lbl in zip(reports, labels) if lbl == cid]
        summary = summarise_cluster(members)
        summary["cluster_id"] = int(cid)
        clusters.append(summary)

    # Sort by count descending — most significant cluster first
    clusters.sort(key=lambda c: c["count"], reverse=True)
    return clusters


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cluster anonymous SafeRoute+ reports.")
    parser.add_argument("--api",         default="http://localhost:4000",
                        help="Backend API base URL (default http://localhost:4000)")
    parser.add_argument("--local",       help="Use a local reports.json instead of the API")
    parser.add_argument("--eps",         type=float, default=DEFAULT_EPS,
                        help=f"DBSCAN eps (default {DEFAULT_EPS})")
    parser.add_argument("--min-samples", type=int,   default=MIN_SAMPLES,
                        help=f"DBSCAN min_samples (default {MIN_SAMPLES})")
    args = parser.parse_args()

    try:
        if args.local:
            reports = load_local_reports(args.local)
        else:
            reports = fetch_reports(args.api)
    except Exception as e:
        print(f"[ERROR] Could not load reports: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Loaded {len(reports)} reports.")
    clusters = run(reports, eps=args.eps, min_samples=args.min_samples)

    output = {"clusters": clusters, "total_reports": len(reports)}
    print(json.dumps(output, indent=2))
