import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitReport } from '../api/reports';
import { useGeolocation } from '../hooks/useGeolocation';
import './ReportPage.css';

const CATEGORIES = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'catcalling', label: 'Catcalling' },
  { value: 'stalking', label: 'Stalking' },
  { value: 'attempted_robbery', label: 'Attempted robbery' },
  { value: 'assault', label: 'Physical assault' },
  { value: 'sexual_assault', label: 'Sexual assault' },
  { value: 'unsafe_area', label: 'Unsafe area / lighting' },
  { value: 'other', label: 'Other' },
];

export default function ReportPage() {
  const navigate = useNavigate();
  const { coords, error: geoError } = useGeolocation(true);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('harassment');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function useMyLocation() {
    if (!coords) return;
    setLat(coords.lat.toFixed(6));
    setLng(coords.lng.toFixed(6));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitReport({
        lat: Number(lat),
        lng: Number(lng),
        description,
        category,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="report-done surface">
        <h1>Thank you.</h1>
        <p>
          Your report was submitted anonymously. It's now part of the community safety map and will help
          others avoid the same situation.
        </p>
        <div className="report-actions">
          <button className="btn btn-primary" onClick={() => navigate('/home')}>Back to home</button>
          <button className="btn btn-secondary" onClick={() => { setDone(false); setDescription(''); }}>
            Submit another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="report-page">
      <h1>Report what happened</h1>
      <p className="muted">
        Your report is anonymous. We don't ask for your name, phone, or any account. The location and
        description are added to the community safety map.
      </p>

      <form onSubmit={onSubmit} className="report-form">
        <div className="report-grid">
          <label className="field">
            <span className="field-label">Latitude</span>
            <input
              className="input"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Longitude</span>
            <input
              className="input"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </label>
        </div>

        <button
          type="button"
          className="btn btn-secondary use-loc"
          onClick={useMyLocation}
          disabled={!coords}
        >
          {coords ? 'Use my current location' : 'Waiting for location…'}
        </button>
        {geoError && <p className="error">Location: {geoError}</p>}

        <label className="field">
          <span className="field-label">Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">What happened?</span>
          <textarea
            className="input"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened. Be as detailed as you're comfortable being — anything helps others."
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit anonymously'}
        </button>
      </form>
    </section>
  );
}
