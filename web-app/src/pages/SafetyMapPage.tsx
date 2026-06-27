import { useEffect, useState } from 'react';
import { listReports, type Report } from '../api/reports';
import { getPatterns, type Patterns } from '../api/patterns';
import MapView from '../components/MapView';
import './SafetyMapPage.css';

const FILTERS = ['All', 'Harassment', 'Assault', 'Stalking', 'Unsafe area'];

function riskLevel(count: number): 'critical' | 'high' | 'moderate' | 'low' {
  if (count >= 5) return 'critical';
  if (count >= 3) return 'high';
  if (count >= 2) return 'moderate';
  return 'low';
}

const RISK_LABELS: Record<string, string> = {
  critical: 'Critical zone',
  high:     'High risk',
  moderate: 'Moderate risk',
  low:      'Low risk',
};

export default function SafetyMapPage() {
  const [reports,  setReports]  = useState<Report[]>([]);
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [filter,   setFilter]   = useState('All');

  useEffect(() => {
    listReports().then((r) => setReports(r.reports)).catch(() => {});
    getPatterns().then(setPatterns).catch(() => {});
  }, []);

  const filtered = filter === 'All'
    ? reports
    : reports.filter((r) => r.category?.toLowerCase().includes(filter.toLowerCase()));

  const center: [number, number] = filtered[0]
    ? [filtered[0].lat, filtered[0].lng]
    : [6.5244, 3.3792];

  const topCluster = patterns?.topLocations?.[0];
  const topRisk = topCluster ? riskLevel(topCluster.count) : null;

  return (
    <div className="map-page">
      <div className="map-page-header">
        <div>
          <h2>Safety map</h2>
          <p className="muted">Community-reported incidents across Lagos.</p>
        </div>
        <div className="map-legend">
          <div className="leg-item"><span className="leg-dot" style={{ background: '#d03b3b' }} />Critical</div>
          <div className="leg-item"><span className="leg-dot" style={{ background: '#eb6834' }} />High risk</div>
          <div className="leg-item"><span className="leg-dot" style={{ background: '#eda100' }} />Moderate</div>
          <div className="leg-item"><span className="leg-dot" style={{ background: '#1baf7a' }} />Low risk</div>
        </div>
      </div>

      {topCluster && topRisk && (
        <div className={`map-alert map-alert-${topRisk}`}>
          <span className="map-alert-dot" />
          <div>
            <strong>{RISK_LABELS[topRisk]}:</strong> cluster near {topCluster.lat.toFixed(3)}, {topCluster.lng.toFixed(3)} — {topCluster.count} reports.
            {topRisk === 'critical' && ' Exercise extreme caution or avoid this area.'}
          </div>
        </div>
      )}

      <div className="map-wrap">
        <MapView
          reports={filtered}
          center={center}
          clusters={patterns?.topLocations}
          height={420}
        />
      </div>

      <div className="map-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-chip${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <span className="map-count">{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
