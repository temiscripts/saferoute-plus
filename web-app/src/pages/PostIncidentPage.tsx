import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitPostIncident, type Mood } from '../api/checkins';
import './PostIncidentPage.css';

const MOODS: { value: Mood; label: string; description: string; tone: 'safe' | 'warn' | 'alert' }[] = [
  { value: 'safe', label: 'I feel safe', description: 'Everything is okay. I just want to log it.', tone: 'safe' },
  { value: 'shaken', label: 'A bit shaken', description: 'Nothing serious, but I want to remember this.', tone: 'safe' },
  { value: 'distressed', label: 'Distressed', description: "I'm not okay. I might want to talk to someone.", tone: 'warn' },
  { value: 'in_danger', label: 'Still in danger', description: 'I need help right now.', tone: 'alert' },
];

export default function PostIncidentPage() {
  const navigate = useNavigate();
  const [mood, setMood] = useState<Mood | null>(null);
  const [notes, setNotes] = useState('');
  const [needsSupport, setNeedsSupport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ needsSupport: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mood) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitPostIncident({ mood, notes: notes || undefined, needsSupport });
      setDone({ needsSupport: res.needsSupport });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit check-in');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="post-incident-done surface">
        <h1>Thanks for checking in.</h1>
        {done.needsSupport ? (
          <>
            <p>
              We hear you. Talking to a professional often helps, even when the immediate danger is over.
              Below are options based in Nigeria.
            </p>
            <ul className="support-list">
              <li><strong>Mentally Aware Nigeria Initiative (MANI):</strong> 0809 111 6264</li>
              <li><strong>Lagos State Domestic & Sexual Violence Response Team:</strong> 0813 796 0048</li>
              <li><strong>Nigeria Emergency:</strong> 112</li>
            </ul>
          </>
        ) : (
          <p>Logged. Take care of yourself.</p>
        )}
        <div className="post-actions">
          <button className="btn btn-primary" onClick={() => navigate('/home')}>Back to home</button>
        </div>
      </section>
    );
  }

  return (
    <section className="post-incident">
      <h1>How are you feeling right now?</h1>
      <p className="muted">Your answer is private. It helps us know if you need anything next.</p>

      <form onSubmit={onSubmit} className="post-form">
        <div className="mood-grid">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`mood-card mood-${m.tone} ${mood === m.value ? 'mood-selected' : ''}`}
              onClick={() => setMood(m.value)}
            >
              <span className="mood-label">{m.label}</span>
              <span className="mood-desc muted">{m.description}</span>
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Anything to add? (optional)</span>
          <textarea
            className="input"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What happened, how it left you feeling, anything you want to remember."
          />
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={needsSupport}
            onChange={(e) => setNeedsSupport(e.target.checked)}
          />
          <span>I'd like contact info for emotional support resources.</span>
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={!mood || submitting}>
          {submitting ? 'Saving…' : 'Submit check-in'}
        </button>
      </form>
    </section>
  );
}
