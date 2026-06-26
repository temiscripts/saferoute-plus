import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPatterns, type Patterns } from '../api/patterns';
import MapView from '../components/MapView';
import AlertStrip from '../components/AlertStrip';
import './PatternDetailsPage.css';

const BUCKET_LABELS: Record<string, string> = {
  morning: 'Morning (5am–12pm)',
  afternoon: 'Afternoon (12–5pm)',
  evening: 'Evening (5–9pm)',
  night: 'Night (9pm–5am)',
};

const CATEGORY_LABELS: Record<string, string> = {
  harassment: 'Harassment',
  catcalling: 'Catcalling',
  stalking: 'Stalking',
  attempted_robbery: 'Attempted robbery',
  assault: 'Physical assault',
  sexual_assault: 'Sexual assault',
  unsafe_area: 'Unsafe area / lighting',
  other: 'Other',
  uncategorized: 'Uncategorized',
};

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="delta delta-neutral">No change</span>;
  return (
    <span className={`delta ${value > 0 ? 'delta-up' : 'delta-down'}`}>
      {value > 0 ? '↑' : '↓'} {Math.abs(value)} vs last week
    </span>
  );
}

export default function PatternDetailsPage() {
  const [data, setData] = useState<Patterns | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatterns()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Loading patterns…</p>;
  if (!data) return <p className="error">Could not load pattern data.</p>;
  if (data.totalReports === 0) {
    return (
      <div className="patterns-page">
        <div className="patterns-header">
          <h1>Community safety patterns</h1>
          <Link to="/home" className="back-link">← Back to home</Link>
        </div>
        <p className="patterns-empty">No reports yet. Patterns will appear here once the community starts submitting.</p>
      </div>
    );
  }

  const buckets = data.timeBuckets;
  const bucketMax = Math.max(...Object.values(buckets).filter((v) => v > 0), 1);
  const catMax = data.topCategories[0]?.count ?? 1;
  const trendMax = Math.max(...data.monthlyTrend.map((m) => m.count), 1);
  const clusterCenter: [number, number] = data.topLocations[0]
    ? [data.topLocations[0].lat, data.topLocations[0].lng]
    : [6.5244, 3.3792];

  return (
    <div className="patterns-page">
      <AlertStrip report={data.recentSevere} />

      <div className="patterns-header">
        <h1>Community safety patterns</h1>
        <p className="muted">
          Based on {data.totalReports.toLocaleString()} {data.totalReports === 1 ? 'report' : 'reports'} in the last 6 months.{' '}
          <Link to="/home" className="back-link">← Back to home</Link>
        </p>
      </div>

      {data.insights.length > 0 && (
        <section className="patterns-card">
          <h2>Key findings</h2>
          <ul className="insights-list">
            {data.insights.map((text, i) => (
              <li key={i} className="insight-item">{text}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="patterns-grid">
        <section className="patterns-card">
          <h2>This week</h2>
          <div className="stat-row">
            <div className="stat-block">
              <span className="stat-num">{data.deltas.reportsLastWeek}</span>
              <span className="stat-label">Reports</span>
              <DeltaBadge value={data.deltas.reportsLastWeekDelta} />
            </div>
            <div className="stat-block">
              <span className="stat-num">{data.deltas.severeLastWeek}</span>
              <span className="stat-label">Severe</span>
              <DeltaBadge value={data.deltas.severeLastWeekDelta} />
            </div>
          </div>
        </section>

        <section className="patterns-card">
          <h2>Time of day</h2>
          <div className="bar-list">
            {(['morning', 'afternoon', 'evening', 'night'] as const).map((b) => (
              <div key={b} className="bar-row">
                <span className="bar-label">{BUCKET_LABELS[b]}</span>
                <div className="bar-track">
                  <div
                    className={`bar-fill bar-${b}`}
                    style={{ width: `${(buckets[b] / bucketMax) * 100}%` }}
                  />
                </div>
                <span className="bar-count">{buckets[b]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {data.topCategories.length > 0 && (
        <section className="patterns-card">
          <h2>Incident types</h2>
          <div className="bar-list">
            {data.topCategories.map(({ category, count }) => (
              <div key={category} className="bar-row">
                <span className="bar-label">{CATEGORY_LABELS[category] ?? category}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill bar-category"
                    style={{ width: `${(count / catMax) * 100}%` }}
                  />
                </div>
                <span className="bar-count">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.topLocations.length > 0 && (
        <section className="patterns-card">
          <h2>Hotspot clusters</h2>
          <p className="muted small">
            Top {data.topLocations.length} report {data.topLocations.length === 1 ? 'cluster' : 'clusters'} — circle size reflects report volume.
          </p>
          <MapView clusters={data.topLocations} center={clusterCenter} height={280} reports={[]} />
        </section>
      )}

      {data.monthlyTrend.length > 0 && (
        <section className="patterns-card">
          <h2>Monthly trend</h2>
          <div className="trend-bars">
            {data.monthlyTrend.map(({ month, count }) => (
              <div key={month} className="trend-col">
                <div className="trend-bar-wrap">
                  <div
                    className="trend-bar-fill"
                    style={{ height: `${(count / trendMax) * 100}%` }}
                  />
                </div>
                <span className="trend-label">{month.slice(5)}</span>
                <span className="trend-count">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
