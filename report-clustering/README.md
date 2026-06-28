# report-clustering

Clusters anonymous incident reports to surface repeat-location and repeat-pattern threats without exposing individual reporter identity.

**Owner:** ML Person #2 (part B).
**Status:** Code ready. Run against live backend or seed data — no dataset download needed.

> Per repo policy, this folder's contents are **not** pushed to GitHub by the project lead. The owner pushes their own work under their own git identity.

## What it does

Fetches anonymous reports from the backend, embeds descriptions with a sentence transformer, then runs DBSCAN on a combined text + geo + time distance matrix. Outputs cluster summaries: centroid location, dominant time-of-day, category breakdown, and report count — never raw descriptions or reporter IDs.

Cluster output is what the **Pattern Details page** (/patterns) presents to users.

## Files

| File | Purpose |
|---|---|
| `cluster.py` | Main script — fetch, embed, cluster, print JSON summary |
| `requirements.txt` | Python dependencies |

## Setup

```bash
cd report-clustering
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Downloads the `all-MiniLM-L6-v2` model automatically on first run (~80 MB).

## Usage

```bash
# Against the live backend (start backend-api first)
python cluster.py --api http://localhost:4000

# Against the local seed data (no backend needed)
python cluster.py --local ../seed-data/reports.json

# Tune clustering sensitivity
python cluster.py --local ../seed-data/reports.json --eps 0.35 --min-samples 2
```

## Output format

```json
{
  "clusters": [
    {
      "cluster_id": 0,
      "count": 5,
      "centroid_lat": 6.51752,
      "centroid_lng": 3.39558,
      "dominant_time": "evening",
      "top_category": "harassment",
      "category_breakdown": { "harassment": 3, "catcalling": 2 },
      "time_breakdown": { "evening": 4, "night": 1 }
    }
  ],
  "total_reports": 40
}
```

## How it works

1. **Embedding:** `all-MiniLM-L6-v2` encodes each description to a 384-dim vector, L2-normalised
2. **Distance matrix:**
   - Text distance (50% weight): cosine distance from normalised embeddings
   - Geo distance (35% weight): haversine, clipped at 5km → [0, 1]
   - Time distance (15% weight): circular hour difference → [0, 1]
3. **Clustering:** DBSCAN (`eps=0.40`, `min_samples=2`) on the combined matrix

### Why DBSCAN over k-means?
- No need to know the number of clusters in advance
- Noise points (one-off reports) are labelled `-1` and excluded from summaries — no reporter is "forced" into a cluster they don't belong to
- Handles the irregular shapes of geographic clusters naturally

### Why this distance weighting?
Text similarity carries most of the weight because incident type is the primary signal. Geographic proximity matters a lot (50m radius incidents are far more likely to be related than 5km apart). Time-of-day carries less weight because the same hotspot is dangerous regardless of hour.

### Why all-MiniLM-L6-v2?
22M parameters, < 1 second to encode 40 reports on CPU, trained on diverse English including informal social text. The quality-to-speed tradeoff is optimal for this task at demo scale.

## Tuning tips

If you're seeing too many clusters (fragmented): increase `--eps` (try 0.45–0.55)
If you're seeing too few (everything merged): decrease `--eps` (try 0.30–0.35)
If single-incident hotspots should appear: decrease `--min-samples` to 1

## Privacy design

- The pipeline reads only the `description`, `lat`, `lng`, `occurred_at`, and `category` fields — no reporter identity, no contact info, nothing linking to a user account
- Cluster summaries contain only aggregate counts and centroid coordinates — never raw report text
- DBSCAN noise points are silently discarded from output

## Demo Day talking point (for the owner)

> "Anonymous reports are powerful, but only if patterns can emerge from them without exposing anyone. We cluster reports by what was described, where, and when — using a sentence transformer to measure 'how similar' two descriptions are. So if three different women independently reported being followed in the same street at night, those become one visible pattern on the map, not three invisible data points. And the model never sees who submitted anything."

## Owner to-do before Demo Day

1. Run `python cluster.py --local ../seed-data/reports.json` and verify sensible clusters appear
2. Run against the live backend with some demo data seeded
3. Tune `eps` and `min-samples` until the cluster output matches the narrative you want to present
4. Optionally: add a `--post` flag that POSTs cluster summaries back to the backend for display on the map
