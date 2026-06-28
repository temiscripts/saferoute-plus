import { api } from './client';

export type Mood = 'safe' | 'shaken' | 'distressed' | 'in_danger';

export function submitPostIncident(input: { mood: Mood; notes?: string; needsSupport?: boolean }) {
  return api<{ id: string; needsSupport: boolean; createdAt: number }>(
    'POST',
    '/checkins/post-incident',
    { body: input },
  );
}
