import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import AlertStrip from '../components/AlertStrip';
import { listReports, type Report } from '../api/reports';
import { getPatterns, type Patterns } from '../api/patterns';
import { useAuth } from '../hooks/useAuth';
import './HomePage.css';

const FEATURES = [
  { icon: '🗺️', title: 'Live safety map',       desc: 'See real-time risk zones and reported incidents across your area.' },
  { icon: '🚩', title: 'Anonymous reporting',   desc: 'Report incidents safely and anonymously — no account needed.' },
  { icon: '📊', title: 'Pattern analysis',      desc: 'Understand when and where risks cluster so you can make smarter decisions.' },
  { icon: '🔔', title: 'Area alerts',            desc: 'Get notified when new incidents are reported near your saved locations.' },
  { icon: '👥', title: 'Community network',     desc: 'Powered by community reports from women across Lagos.' },
  { icon: '🆘', title: 'Emergency SOS',          desc: 'One-tap SOS sends your live location to trusted contacts instantly.' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports]   = useState<Report[]>([]);
  const [patterns, setPatterns] = useState<Patterns | null>(null);

  useEffect(() => {
    listReports().then((r) => setReports(r.reports)).catch(() => {});
    getPatterns().then(setPatterns).catch(() => {});
  }, []);

  const center: [number, number] = reports[0]
    ? [reports[0].lat, reports[0].lng]
    : [6.5244, 3.3792];

  const total   = patterns?.totalReports ?? 0;
  const severe  = patterns?.deltas?.severeLastWeek ?? 0;

  return (
    <div className="home">
      <AlertStrip report={patterns?.recentSevere ?? null} />

      {/* Hero */}
      <section className="home-hero">
        <div className="hero-tag">Women's safety network</div>
        <h1>Stay informed.<br /><span className="hero-accent">Stay safe.</span></h1>
        <p className="hero-sub">
          Real-time community safety mapping for women across Lagos. Report incidents,
          view risk zones, and help keep each other safe.
        </p>
        <div className="hero-actions">
          <Link to="/map" className="btn btn-primary">View safety map</Link>
          <Link to="/report" className="btn btn-secondary">Report an incident</Link>
          {user && (
            <button className="btn btn-active-session" onClick={() => navigate('/session/active')}>
              Start safe session
            </button>
          )}
        </div>
      </section>

      {/* Stats */}
      <div className="home-stats">
        <div className="stat-cell">
          <div className="stat-n">{total > 0 ? total.toLocaleString() : '—'}</div>
          <div className="stat-l">Incidents reported</div>
        </div>
        <div className="stat-cell">
          <div className="stat-n">{severe > 0 ? severe : '—'}</div>
          <div className="stat-l">Critical this week</div>
        </div>
        <div className="stat-cell">
          <div className="stat-n">Lagos</div>
          <div className="stat-l">Coverage area</div>
        </div>
      </div>

      {/* Map preview */}
      <section className="home-map">
        <div className="section-head">
          <h3>Community safety map</h3>
          <Link to="/map" className="see-all">View full map →</Link>
        </div>
        <MapView reports={reports} center={center} clusters={patterns?.topLocations} height={280} />
      </section>

      {/* Features */}
      <section className="home-features">
        <h3>What SafeRoute Plus does</h3>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="fcard">
              <div className="fcard-icon">{f.icon}</div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
