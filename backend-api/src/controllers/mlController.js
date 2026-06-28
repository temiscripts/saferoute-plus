import { env } from '../config/env.js';
import { db } from '../db/sqlite.js';
import { nowSeconds } from '../utils/ids.js';

const selectReportsForClustering = db.prepare(
  'SELECT id, lat, lng, description, category, severity, occurred_at, created_at FROM reports WHERE created_at >= ? ORDER BY created_at DESC LIMIT 500',
);

async function proxyJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error ?? 'ML service error'), { status: res.status });
  return json;
}

export async function predictVoice(req, res, next) {
  try {
    if (!env.mlVoiceUrl) return res.status(503).json({ error: 'Voice ML service not configured' });
    if (!req.file) return res.status(400).json({ error: "Missing 'audio' file" });

    const form = new FormData();
    form.append('audio', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const result = await proxyJson(`${env.mlVoiceUrl}/predict`, { method: 'POST', body: form });
    res.json(result);
  } catch (err) { next(err); }
}

export async function predictMotion(req, res, next) {
  try {
    if (!env.mlMotionUrl) return res.status(503).json({ error: 'Motion ML service not configured' });
    const { samples } = req.body;
    if (!Array.isArray(samples)) return res.status(400).json({ error: "Body must have 'samples' array" });

    const result = await proxyJson(`${env.mlMotionUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ samples }),
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function getClusters(req, res, next) {
  try {
    if (!env.mlClusteringUrl) return res.status(503).json({ error: 'Clustering ML service not configured' });

    const eps         = req.query.eps         ?? '0.40';
    const minSamples  = req.query.min_samples ?? '2';

    // Fetch reports directly from the local DB — avoids cross-container HTTP calls
    const cutoff  = nowSeconds() - 180 * 86400; // last 6 months
    const reports = selectReportsForClustering.all(cutoff).map((r) => ({
      id:          r.id,
      lat:         r.lat,
      lng:         r.lng,
      description: r.description,
      category:    r.category ?? 'other',
      severity:    r.severity ?? null,
      occurred_at: r.occurred_at ?? r.created_at,
      created_at:  r.created_at,
    }));

    const result = await proxyJson(`${env.mlClusteringUrl}/clusters`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reports, eps: parseFloat(eps), min_samples: parseInt(minSamples) }),
    });
    res.json(result);
  } catch (err) { next(err); }
}
