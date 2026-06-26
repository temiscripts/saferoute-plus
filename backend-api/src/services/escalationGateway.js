let engine = null;

export function setEscalationEngine(instance) {
  engine = instance;
}

export function triggerSos(sessionId, reason = 'manual_sos') {
  if (!engine) return Promise.resolve(null);
  return engine.triggerSos(sessionId, reason);
}

export function cancelEscalationForSession(sessionId) {
  if (!engine) return false;
  return engine.cancelForSession(sessionId);
}
