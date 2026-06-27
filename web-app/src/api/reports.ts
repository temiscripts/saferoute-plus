import { api } from './client';

export type Report = {
  id: string;
  lat: number;
  lng: number;
  description: string;
  category: string | null;
  occurred_at: number | null;
  created_at: number;
};

export function listReports(limit = 200, sinceDays = 180) {
  return api<{ reports: Report[] }>('GET', '/reports', { auth: false, query: { limit, sinceDays } });
}

export function submitReport(input: {
  lat: number;
  lng: number;
  description: string;
  category?: string;
  severity?: 'critical' | 'high' | 'moderate';
  occurredAt?: number;
}) {
  return api<{ id: string; createdAt: number }>('POST', '/reports', { auth: false, body: input });
}
