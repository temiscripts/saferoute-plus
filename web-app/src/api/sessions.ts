import { api } from './client';

export type SessionStatus = 'active' | 'sos' | 'ended';

export type Session = {
  id: string;
  status: SessionStatus;
  started_at: number;
  last_checkin_at: number;
  ended_at: number | null;
  sos_triggered_at: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
};

export type Location = { lat: number; lng: number; recorded_at: number };

export function startSession(input: { destinationLat?: number; destinationLng?: number } = {}) {
  return api<{ session: { id: string; status: SessionStatus; startedAt: number } }>(
    'POST',
    '/sessions',
    { body: input },
  );
}

export function checkinSession(id: string, location?: { lat: number; lng: number }) {
  return api<{ ok: true; lastCheckinAt: number }>(
    'POST',
    `/sessions/${id}/checkin`,
    { body: location ?? {} },
  );
}

export function triggerSos(id: string, location?: { lat: number; lng: number }) {
  return api<{ ok: true; status: 'sos'; sosTriggeredAt: number; escalation: unknown }>(
    'POST',
    `/sessions/${id}/sos`,
    { body: location ?? {} },
  );
}

export function endSession(id: string) {
  return api<{ ok: true }>('POST', `/sessions/${id}/end`);
}

export function getSession(id: string) {
  return api<{ session: Session; locations: Location[] }>('GET', `/sessions/${id}`);
}
