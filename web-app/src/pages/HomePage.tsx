import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SosButton from '../components/SosButton';
import MapView from '../components/MapView';
import AlertStrip from '../components/AlertStrip';
import StatsDashboard from '../components/StatsDashboard';
import { listReports, type Report } from '../api/reports';
import { getPatterns, type Patterns } from '../api/patterns';
import { useAuth } from '../hooks/useAuth';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [patterns, setPatterns] = useState<Patterns | null>(null);

  useEffect(() => {
    listReports().then((r) => setReports(r.reports)).catch(() => {});
    getPatterns().then(setPatterns).catch(() => {});
  }, []);

  const center: [number, number] = reports[0]
    ? [reports[0].lat, reports[0].lng]
    : [6.5244, 3.3792];

  return (
    <div className="home">
      <AlertStrip report={patterns?.recentSevere ?? null} />

      <section className="home-hero">
        <div className="home-hero-text">
          <h1>Quiet by default. Loud when it counts.</h1>
          <p className="muted">
            {user?.name ? `Hi ${user.name}.` : 'Hi.'} Tap the SOS to start an active session — we'll
            watch your check-ins and reach your trusted contacts the moment you need them.
          </p>
          <div className="home-hero-actions">
            <SosButton mode="idle" onClick={() => navigate('/session/active')} />
            <Link to="/report" className="btn btn-secondary">Report something</Link>
          </div>
        </div>
      </section>

      <StatsDashboard data={patterns} />

      <section className="home-map">
        <div className="section-head">
          <h3>Community safety map</h3>
          <Link to="/patterns" className="muted small">See patterns →</Link>
        </div>
        <MapView reports={reports} center={center} />
      </section>
    </div>
  );
}
