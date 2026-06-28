export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/[\s\-()]/g, '');
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  if (/^0\d{10}$/.test(trimmed)) return `+234${trimmed.slice(1)}`;
  if (/^\d{10}$/.test(trimmed)) return `+234${trimmed}`;
  return null;
}
