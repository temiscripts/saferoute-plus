import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitReport } from '../api/reports';
import { useGeolocation } from '../hooks/useGeolocation';
import './ReportPage.css';

const CATEGORIES = [
  { value: 'harassment',        label: 'Harassment' },
  { value: 'catcalling',        label: 'Catcalling' },
  { value: 'stalking',          label: 'Stalking' },
  { value: 'attempted_robbery', label: 'Attempted robbery' },
  { value: 'assault',           label: 'Physical assault' },
  { value: 'sexual_assault',    label: 'Sexual assault' },
  { value: 'unsafe_area',       label: 'Unsafe area / poor lighting' },
  { value: 'other',             label: 'Other' },
];

const LGAS = [
  'Alimosho', 'Ajeromi-Ifelodun', 'Kosofe', 'Mushin', 'Oshodi-Isolo',
  'Ojo', 'Ikorodu', 'Surulere', 'Agege', 'Ifako-Ijaiye',
  'Shomolu', 'Abeokuta', 'Lagos Island', 'Lagos Mainland', 'Ikeja',
  'Eti-Osa', 'Badagry', 'Ibeju-Lekki', 'Epe', 'Apapa', 'Yaba',
];

// Reverse geocode lat/lng → readable place name via Nominatim (free, no key)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const a = data.address ?? {};
    return (
      a.neighbourhood || a.suburb || a.city_district ||
      a.town || a.village || a.county || 'Lagos'
    );
  } catch {
    return 'Lagos';
  }
}

// Forward geocode a text address → lat/lng via Nominatim
async function geocodeAddress(text: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${text}, Lagos, Nigeria`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

export default function ReportPage() {
  const navigate = useNavigate();
  const { coords } = useGeolocation(true);

  const [location,    setLocation]    = useState('');
  const [lga,         setLga]         = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState('harassment');
  const [severity,    setSeverity]    = useState<'critical' | 'high' | 'moderate'>('moderate');
  const [gpsCoords,   setGpsCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [locating,    setLocating]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [done,        setDone]        = useState(false);

  async function useMyLocation() {
    if (!coords) return;
    setLocating(true);
    setGpsCoords({ lat: coords.lat, lng: coords.lng });
    const name = await reverseGeocode(coords.lat, coords.lng);
    setLocation(name);
    setLocating(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let lat: number, lng: number;

      if (gpsCoords) {
        lat = gpsCoords.lat;
        lng = gpsCoords.lng;
      } else {
        const searchText = [location, lga].filter(Boolean).join(', ');
        const geo = await geocodeAddress(searchText);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
        } else {
          // Fall back to Lagos centre
          lat = 6.5244;
          lng = 3.3792;
        }
      }

      await submitReport({ lat, lng, description, category, severity });
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
          Your report was submitted anonymously. It's now part of the community
          safety map and will help others avoid the same situation.
        </p>
        <div className="report-actions">
          <button className="btn btn-primary" onClick={() => navigate('/home')}>Back to home</button>
          <button className="btn btn-secondary" onClick={() => { setDone(false); setDescription(''); setLocation(''); setGpsCoords(null); }}>
            Submit another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="report-page">
      <h1>Report an incident</h1>
      <p className="muted">
        Your report is anonymous. We don't ask for your name, phone, or any account.
        The location and description are added to the community safety map.
      </p>

      <form onSubmit={onSubmit} className="report-form">

        {/* Location */}
        <div className="report-grid">
          <label className="field">
            <span className="field-label">Area / street</span>
            <input
              className="input"
              type="text"
              placeholder="e.g. Allen Avenue, Ikeja"
              value={location}
              onChange={(e) => { setLocation(e.target.value); setGpsCoords(null); }}
            />
          </label>
          <label className="field">
            <span className="field-label">LGA</span>
            <select className="input" value={lga} onChange={(e) => setLga(e.target.value)}>
              <option value="">Select LGA (optional)</option>
              {LGAS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>

        <button
          type="button"
          className="btn btn-secondary use-loc"
          onClick={useMyLocation}
          disabled={!coords || locating}
        >
          {locating ? 'Getting location…' : coords ? '📍 Use my current location' : 'Waiting for GPS…'}
        </button>

        {/* Category + severity */}
        <div className="report-grid">
          <label className="field">
            <span className="field-label">Incident type</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field-label">Severity level</span>
            <div className="sev-chips">
              {(['critical', 'high', 'moderate'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`sev-chip sev-${s}${severity === s ? ' sev-selected' : ''}`}
                  onClick={() => setSeverity(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

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
