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
import { classifyVoice, classifyMotion } from '../api/ml';
import { blobToWav } from '../utils/toWav';
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
  const [mlAlert, setMlAlert] = useState<{ type: 'voice' | 'motion'; message: string } | null>(null);
  const autoTimerRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const motionTimerRef = useRef<number | null>(null);
  const motionSamplesRef = useRef<[number, number, number][]>([]);

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

  // Voice distress monitoring — records 10s audio clips and sends to ML service
  useEffect(() => {
    if (!sessionId || status !== 'active') return;
    if (!navigator.mediaDevices?.getUserMedia) return;

    let stopped = false;
    let stream: MediaStream | null = null;
    let currentRecorder: MediaRecorder | null = null;

    async function startVoice() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }

        function recordClip() {
          if (stopped || !stream) return;
          const chunks: Blob[] = [];
          currentRecorder = new MediaRecorder(stream);
          currentRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          currentRecorder.onstop = async () => {
            if (stopped) return;
            try {
              const mimeType = currentRecorder?.mimeType ?? 'audio/webm';
              const raw = new Blob(chunks, { type: mimeType });
              const blob = await blobToWav(raw);
              const result = await classifyVoice(blob);
              if (result.label === 'distress' && result.confidence >= 0.65) {
                setMlAlert({ type: 'voice', message: `Voice distress detected (${Math.round(result.confidence * 100)}% confidence). Are you OK?` });
              }
            } catch { /* ML service unavailable — silently skip */ }
            voiceTimerRef.current = window.setTimeout(recordClip, 2000);
          };
          currentRecorder.start();
          window.setTimeout(() => { if (currentRecorder?.state === 'recording') currentRecorder.stop(); }, 10_000);
        }
        recordClip();
      } catch { /* mic denied — skip silently */ }
    }
    startVoice();

    return () => {
      stopped = true;
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      if (currentRecorder?.state === 'recording') currentRecorder.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [sessionId, status]);

  // Motion anomaly monitoring — batches DeviceMotion samples and sends to ML service
  useEffect(() => {
    if (!sessionId || status !== 'active') return;
    if (typeof DeviceMotionEvent === 'undefined') return;

    let stopped = false;

    function onMotion(e: DeviceMotionEvent) {
      const acc = e.acceleration ?? e.accelerationIncludingGravity;
      if (acc?.x != null && acc.y != null && acc.z != null) {
        motionSamplesRef.current.push([acc.x, acc.y, acc.z]);
      }
    }

    async function analyzeMotion() {
      if (stopped) return;
      const batch = motionSamplesRef.current.splice(0);
      if (batch.length >= 10) {
        try {
          const result = await classifyMotion(batch);
          if (result.label === 'anomaly' && result.confidence >= 0.65) {
            setMlAlert({ type: 'motion', message: 'Unusual movement detected. Are you OK?' });
          }
        } catch { /* ML service unavailable — skip */ }
      }
      if (!stopped) motionTimerRef.current = window.setTimeout(analyzeMotion, 5_000);
    }

    window.addEventListener('devicemotion', onMotion as EventListener);
    motionTimerRef.current = window.setTimeout(analyzeMotion, 5_000);

    return () => {
      stopped = true;
      window.removeEventListener('devicemotion', onMotion as EventListener);
      if (motionTimerRef.current) clearTimeout(motionTimerRef.current);
    };
  }, [sessionId, status]);

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

      {mlAlert && (
        <div className={`ml-alert ml-alert-${mlAlert.type}`}>
          <span className="ml-alert-icon">{mlAlert.type === 'voice' ? '🎤' : '📡'}</span>
          <span className="ml-alert-msg">{mlAlert.message}</span>
          <button className="ml-alert-dismiss" onClick={() => setMlAlert(null)}>Dismiss</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="session-actions">
        <SosButton mode={status === 'sos' ? 'alert' : 'active'} onClick={onSos} disabled={status === 'sos'} />
        <button className="btn btn-secondary" onClick={onEnd}>End session</button>
      </div>
    </section>
  );
}
