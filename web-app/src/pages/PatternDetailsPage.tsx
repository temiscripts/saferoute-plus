import { useEffect, useState } from 'react';
import { getPatterns, type Patterns } from '../api/patterns';
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

export default function PatternDetailsPage() {
  const [data,    setData]    = useState<Patterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>('time');

  useEffect(() => {
    getPatterns().then(setData).catch(() => {}).finally(() => setLoading(false));
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
          {data.topLocations.length === 0 ? (
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
