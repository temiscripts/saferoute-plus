import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SosButton from '../components/SosButton';
import DeadmanBar from '../components/DeadmanBar';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCountdown } from '../hooks/useCountdown';
import {
  startSession,
  checkinSession,
  triggerSos,
  endSession,
  type SessionStatus,
} from '../api/sessions';
import './ActiveSessionPage.css';

const AUTO_INTERVAL = Number(import.meta.env.VITE_CHECKIN_AUTO_INTERVAL_SECONDS ?? 60);
const THRESHOLD = Number(import.meta.env.VITE_CHECKIN_DEADMAN_THRESHOLD_SECONDS ?? 120);

export default function ActiveSessionPage() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('active');
  const [lastCheckinMs, setLastCheckinMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const autoTimerRef = useRef<number | null>(null);

  const { coords, error: geoError } = useGeolocation(sessionId !== null && status === 'active');
  const deadlineMs = lastCheckinMs ? lastCheckinMs + THRESHOLD * 1000 : null;
  const { remainingSeconds } = useCountdown(deadlineMs);

  const doCheckin = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await checkinSession(
        sessionId,
        coords ? { lat: coords.lat, lng: coords.lng } : undefined,
      );
      setLastCheckinMs(res.lastCheckinAt * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    }
  }, [sessionId, coords]);

  useEffect(() => {
    if (!sessionId || status !== 'active') return;
    autoTimerRef.current = window.setInterval(doCheckin, AUTO_INTERVAL * 1000);
    return () => {
      if (autoTimerRef.current) window.clearInterval(autoTimerRef.current);
    };
  }, [sessionId, status, doCheckin]);

  async function onStart() {
    setError(null);
    setStarting(true);
    try {
      const res = await startSession();
      setSessionId(res.session.id);
      setStatus(res.session.status);
      setLastCheckinMs(res.session.startedAt * 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start session');
    } finally {
      setStarting(false);
    }
  }

  async function onSos() {
    if (!sessionId) return;
    try {
      await triggerSos(sessionId, coords ? { lat: coords.lat, lng: coords.lng } : undefined);
      setStatus('sos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not trigger SOS');
    }
  }

  async function onEnd() {
    if (!sessionId) {
      navigate('/home');
      return;
    }
    try {
      await endSession(sessionId);
      setStatus('ended');
      navigate('/post-incident');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end session');
    }
  }

  if (!sessionId) {
    return (
      <section className="session-start">
        <h1>Start an active session</h1>
        <p className="muted">
          While active, the app will check on you every {AUTO_INTERVAL} seconds. If we lose contact for
          longer than {THRESHOLD} seconds, your trusted contacts will be notified automatically.
        </p>
        {geoError && <p className="error">Location: {geoError}</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" onClick={onStart} disabled={starting}>
          {starting ? 'Starting…' : "I'm starting my trip"}
        </button>
      </section>
    );
  }

  return (
    <section className="session-active">
      <header className="session-head">
        <h1>{status === 'sos' ? 'SOS active' : 'Session active'}</h1>
        <p className="muted">
          {status === 'sos'
            ? 'We are reaching your trusted contacts now.'
            : 'You are being watched over. Tap "I\'m OK" anytime to reset the timer.'}
        </p>
      </header>

      <DeadmanBar
        remainingSeconds={remainingSeconds}
        totalSeconds={THRESHOLD}
        status={status}
        onCheckin={doCheckin}
      />

      <div className="session-meta surface">
        <dl>
          <div><dt>Status</dt><dd className={`status status-${status}`}>{status}</dd></div>
          <div><dt>Location</dt><dd>{coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '—'}</dd></div>
          <div><dt>Accuracy</dt><dd>{coords?.accuracy ? `${Math.round(coords.accuracy)}m` : '—'}</dd></div>
          <div><dt>Auto check-in</dt><dd>every {AUTO_INTERVAL}s</dd></div>
        </dl>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="session-actions">
        <SosButton mode={status === 'sos' ? 'alert' : 'active'} onClick={onSos} disabled={status === 'sos'} />
        <button className="btn btn-secondary" onClick={onEnd}>End session</button>
      </div>
    </section>
  );
}
