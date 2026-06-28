import { useEffect, useState } from 'react';
import { getPatterns, type Patterns } from '../api/patterns';
import { fetchClusters, type Cluster } from '../api/ml';
import MapView from '../components/MapView';
import './PatternDetailsPage.css';

type Tab = 'time' | 'location' | 'types' | 'monthly';

const TABS: { id: Tab; label: string }[] = [
  { id: 'time',     label: 'Time patterns' },
  { id: 'location', label: 'Location clusters' },
  { id: 'types',    label: 'Incident types' },
  { id: 'monthly',  label: 'Monthly trends' },
];

const CATEGORY_LABELS: Record<string, string> = {
  harassment:        'Harassment',
  catcalling:        'Catcalling',
  stalking:          'Stalking',
  attempted_robbery: 'Attempted robbery',
  assault:           'Physical assault',
  sexual_assault:    'Sexual assault',
  unsafe_area:       'Unsafe area / lighting',
  other:             'Other',
  uncategorized:     'Uncategorized',
};

function insightBadge(text: string): { label: string; cls: string } {
  const t = text.toLowerCase();
  if (t.includes('hotspot') || t.includes('critical') || t.includes('severe'))
    return { label: 'High priority', cls: 'badge-red' };
  if (t.includes('night') || t.includes('evening') || t.includes('lighting'))
    return { label: 'Time pattern', cls: 'badge-purple' };
  if (t.includes('type') || t.includes('common') || t.includes('repeat'))
    return { label: 'Pattern match', cls: 'badge-blue' };
  return { label: 'Trend', cls: 'badge-amber' };
}

function PatternCard({
  title, subtitle, body, pct, barColor,
}: {
  title: string; subtitle: string; body: string; pct: number; barColor: string;
}) {
  return (
    <div className="pd-card">
      <div className="pd-card-top">
        <div className="pd-card-icon" />
        <div>
          <div className="pd-card-title">{title}</div>
          <div className="pd-card-sub">{subtitle}</div>
        </div>
      </div>
      <p className="pd-card-body">{body}</p>
      <div className="pd-bar-track">
        <div
          className="pd-bar-fill"
          style={{ width: `${Math.min(Math.max(pct, 2), 100)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

const RISK_COLORS: Record<string, string> = {
  critical: '#d03b3b',
  high:     '#eb6834',
  moderate: '#eda100',
  low:      '#7c4db8',
};

export default function PatternDetailsPage() {
  const [data,         setData]         = useState<Patterns | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [clusters,     setClusters]     = useState<Cluster[]>([]);
  const [clusterTotal, setClusterTotal] = useState(0);
  const [tab,          setTab]          = useState<Tab>('time');

  useEffect(() => {
    getPatterns().then(setData).catch(() => {}).finally(() => setLoading(false));
    fetchClusters().then((r) => { setClusters(r.clusters); setClusterTotal(r.total_reports); }).catch(() => {});
  }, []);

  if (loading) return <p className="muted pd-loading">Loading patterns…</p>;
  if (!data)   return <p className="error">Could not load pattern data.</p>;

  const total    = Object.values(data.timeBuckets).reduce((s, n) => s + n, 0) || 1;
  const pct      = (b: keyof typeof data.timeBuckets) =>
    Math.round((data.timeBuckets[b] / total) * 100);

  const catMax   = data.topCategories[0]?.count ?? 1;
  const trendMax = Math.max(...data.monthlyTrend.map((m) => m.count), 1);
  const locMax   = data.topLocations[0]?.count ?? 1;

  const weekDelta = data.deltas.reportsLastWeekDelta;
  const prevWeek  = data.deltas.reportsLastWeek - weekDelta;
  const weekPct   = prevWeek > 0 ? Math.abs(Math.round((weekDelta / prevWeek) * 100)) : 0;

  const clusterCenter: [number, number] = data.topLocations[0]
    ? [data.topLocations[0].lat, data.topLocations[0].lng]
    : [6.5244, 3.3792];

  return (
    <div className="pd-page">
      <div className="pd-header">
        <h1>Pattern details</h1>
        <p className="muted">
          Trends and recurring risk patterns identified from {data.totalReports.toLocaleString()} community reports.
        </p>
      </div>

      <div className="pd-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`pd-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'time' && (
        <div className="pd-grid">
          <PatternCard
            title="Evening peak risk"
            subtitle="5 PM – 9 PM"
            body={`${pct('evening')}% of all incidents occur in this window.`}
            pct={pct('evening')}
            barColor="#d03b3b"
          />
          <PatternCard
            title="Night risk"
            subtitle="9 PM – 5 AM"
            body={`${pct('night')}% of incidents are reported at night.`}
            pct={pct('night')}
            barColor="#eb6834"
          />
          <PatternCard
            title="Morning activity"
            subtitle="5 AM – 12 PM"
            body={`${pct('morning')}% of reports fall in the morning hours.`}
            pct={pct('morning')}
            barColor="#eda100"
          />
          <PatternCard
            title="Afternoon window"
            subtitle="12 PM – 5 PM"
            body={`${pct('afternoon')}% of incidents occur in the afternoon.`}
            pct={pct('afternoon')}
            barColor="#7c4db8"
          />
        </div>
      )}

      {tab === 'location' && (
        <div className="pd-grid">
          {clusters.length > 0 ? (
            <>
              <p className="pd-cluster-note muted">
                ML-identified clusters from {clusterTotal} reports — grouped by location, description and time.
              </p>
              {clusters.map((c) => (
                <PatternCard
                  key={c.cluster_id}
                  title={`${c.risk_level.charAt(0).toUpperCase() + c.risk_level.slice(1)} risk cluster`}
                  subtitle={`${c.count} report${c.count !== 1 ? 's' : ''} · ${c.dominant_time} · ${c.top_category}`}
                  body={`Risk score ${c.risk_score.toFixed(1)} · centred near ${c.centroid_lat.toFixed(3)}, ${c.centroid_lng.toFixed(3)}`}
                  pct={Math.round(c.risk_score / 3 * 100)}
                  barColor={RISK_COLORS[c.risk_level] ?? '#7c4db8'}
                />
              ))}
              <div className="pd-map-card">
                <MapView
                  clusters={clusters.map((c) => ({ lat: c.centroid_lat, lng: c.centroid_lng, count: c.count }))}
                  center={[clusters[0].centroid_lat, clusters[0].centroid_lng]}
                  height={260}
                  reports={[]}
                />
              </div>
            </>
          ) : data.topLocations.length === 0 ? (
            <p className="muted">No location clusters yet.</p>
          ) : (
            <>
              {data.topLocations.map((loc, i) => (
                <PatternCard
                  key={i}
                  title={`Hotspot #${i + 1}`}
                  subtitle={`${loc.count} incident${loc.count !== 1 ? 's' : ''} reported`}
                  body="See the safety map to view this cluster's exact location."
                  pct={Math.round((loc.count / locMax) * 100)}
                  barColor={['#d03b3b', '#eb6834', '#eda100', '#7c4db8', '#a87fd4'][i] ?? '#7c4db8'}
                />
              ))}
              <div className="pd-map-card">
                <MapView clusters={data.topLocations} center={clusterCenter} height={260} reports={[]} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'types' && (
        <div className="pd-grid">
          {data.topCategories.length === 0 ? (
            <p className="muted">No incident type data yet.</p>
          ) : (
            data.topCategories.map(({ category, count }) => (
              <PatternCard
                key={category}
                title={CATEGORY_LABELS[category] ?? category}
                subtitle={`${count} report${count !== 1 ? 's' : ''}`}
                body={`${Math.round((count / (data.totalReports || 1)) * 100)}% of all community reports.`}
                pct={Math.round((count / catMax) * 100)}
                barColor="#7c4db8"
              />
            ))
          )}
        </div>
      )}

      {tab === 'monthly' && (
        <div className="pd-grid">
          <PatternCard
            title="Month-on-month"
            subtitle={
              weekDelta > 0
                ? `Reports up ${weekPct}%`
                : weekDelta < 0
                ? `Reports down ${weekPct}%`
                : 'Stable'
            }
            body={
              weekDelta > 0
                ? 'Could reflect growing platform awareness and adoption.'
                : weekDelta < 0
                ? 'Incident reports are trending down this period.'
                : 'Report volume is consistent week over week.'
            }
            pct={Math.min(weekPct, 100)}
            barColor="#7c4db8"
          />
          {data.monthlyTrend.map(({ month, count }) => (
            <PatternCard
              key={month}
              title={new Date(`${month}-02`).toLocaleString('default', { month: 'long', year: 'numeric' })}
              subtitle={`${count} report${count !== 1 ? 's' : ''}`}
              body={`${Math.round((count / (data.totalReports || 1)) * 100)}% of all reports logged this month.`}
              pct={Math.round((count / trendMax) * 100)}
              barColor="#a87fd4"
            />
          ))}
        </div>
      )}

      {data.insights.length > 0 && (
        <section className="pd-insights">
          <h2>Key insights</h2>
          <div className="pd-insights-list">
            {data.insights.map((text, i) => {
              const badge = insightBadge(text);
              return (
                <div key={i} className="pd-insight-row">
                  <div className="pd-insight-dot" />
                  <div className="pd-insight-content">
                    <p className="pd-insight-text">{text}</p>
                    <span className={`pd-badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
