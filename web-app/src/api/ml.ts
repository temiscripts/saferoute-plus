import { api, getStoredToken } from './client';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type VoiceResult = {
  label: 'distress' | 'calm';
  confidence: number;
  threshold_used: number;
  probabilities: Record<string, number>;
};

export type MotionResult = {
  label: 'anomaly' | 'normal';
  confidence: number;
  windows_scored: number;
  anomaly_windows: number;
  per_window_proba: number[];
};

export type Cluster = {
  cluster_id: number;
  count: number;
  centroid_lat: number;
  centroid_lng: number;
  dominant_time: string;
  top_category: string;
  category_breakdown: Record<string, number>;
  time_breakdown: Record<string, number>;
  risk_score: number;
  risk_level: 'critical' | 'high' | 'moderate' | 'low';
  severity_breakdown: Record<string, number>;
};

export type ClustersResult = {
  clusters: Cluster[];
  total_reports: number;
};

export async function classifyVoice(blob: Blob): Promise<VoiceResult> {
  const form = new FormData();
  form.append('audio', blob, 'clip.wav');

  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}/ml/voice`, { method: 'POST', headers, body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Voice ML failed');
  return json as VoiceResult;
}

export async function classifyMotion(samples: [number, number, number][]): Promise<MotionResult> {
  return api<MotionResult>('POST', '/ml/motion', { body: { samples } });
}

export async function fetchClusters(): Promise<ClustersResult> {
  return api<ClustersResult>('GET', '/ml/clusters');
}
