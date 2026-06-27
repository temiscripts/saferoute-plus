import { useEffect, useState } from 'react';
import { listReports, type Report } from '../api/reports';
import { getPatterns, type Patterns } from '../api/patterns';
import './DashboardPage.css';

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SEV_CLASS: Record<string, string> = {
  critical: 'sev-crit',
  high:     'sev-high',
  moderate: 'sev-mod',
};

export default function DashboardPage() {
  const [reports,  setReports]  = useState<Report[]>([]);
  const [patterns, setPatterns] = useState<Patterns | null>(null);

  useEffect(() => {
    listReports(50, 30).then((r) => setReports(r.reports)).catch(() => {});
    getPatterns().then(setPatterns).catch(() => {});
  }, []);

  const total       = patterns?.totalReports ?? 0;
  const lastWeek    = patterns?.deltas?.reportsLastWeek ?? 0;
  const severeWeek  = patterns?.deltas?.severeLastWeek ?? 0;
  const weekDelta   = patterns?.deltas?.reportsLastWeekDelta ?? 0;

  const topCats   = patterns?.topCategories?.slice(0, 6) ?? [];
  const maxCatCnt = topCats[0]?.count ?? 1;

  const recent = reports.slice(0, 8);

  return (
    <div className="dash-page">
      <div className="dash-header">
        <h2>Dashboard</h2>
        <p className="muted">Overview of incident data — last 30 days</p>
      </div>

      {/* Stats row */}
      <div className="dash-stats">
        <div className="dash-stat">
          <div className="stat-n" style={{ color: 'var(--red)' }}>{severeWeek}</div>
          <div className="stat-l">Critical this week</div>
          {patterns?.deltas?.severeLastWeekDelta !== undefined && (
            <div className={`stat-d ${patterns.deltas.severeLastWeekDelta > 0 ? 'up' : 'down'}`}>
              {patterns.deltas.severeLastWeekDelta > 0 ? '+' : ''}{patterns.deltas.severeLastWeekDelta} vs last week
            </div>
          )}
        </div>
        <div className="dash-stat">
          <div className="stat-n" style={{ color: 'var(--orange)' }}>{lastWeek}</div>
          <div className="stat-l">Reports this week</div>
          {weekDelta !== 0 && (
            <div className={`stat-d ${weekDelta > 0 ? 'up' : 'down'}`}>
              {weekDelta > 0 ? '+' : ''}{weekDelta} vs last week
            </div>
          )}
        </div>
        <div className="dash-stat">
          <div className="stat-n">{total}</div>
          <div className="stat-l">Total reports</div>
        </div>
        <div className="dash-stat">
          <div className="stat-n" style={{ color: 'var(--lav-700)' }}>{patterns?.topLocations?.length ?? 0}</div>
          <div className="stat-l">Active hotspots</div>
        </div>
      </div>

      <div className="dash-body">
        {/* Recent incidents */}
        <div className="dash-panel">
          <h3>Recent incidents</h3>
          {recent.length === 0 ? (
            <p className="muted">No reports yet.</p>
          ) : (
            <div className="incident-list">
              {recent.map((r) => (
                <div key={r.id} className="incident-row">
                  <span className={`sev-badge ${SEV_CLASS[(r as any).severity] ?? 'sev-mod'}`}>
                    {(r as any).severity ?? r.category ?? 'report'}
                  </span>
                  <div className="incident-info">
                    <div className="incident-loc">{r.category ?? 'Incident'}</div>
                    <div className="incident-time">{timeAgo(r.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reports by category */}
        <div className="dash-panel">
          <h3>Reports by category</h3>
          {topCats.length === 0 ? (
            <p className="muted">No data yet.</p>
          ) : (
            <div className="cat-bars">
              {topCats.map((c) => (
                <div key={c.category} className="bar-row">
                  <span className="bar-label">{c.category}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(c.count / maxCatCnt) * 100}%` }} />
                  </div>
                  <span className="bar-val">{c.count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Time of day */}
          {patterns?.timeBuckets && (
            <div className="time-breakdown">
              <h4>Time of day</h4>
              <div className="time-bars">
                {(['morning', 'afternoon', 'evening', 'night'] as const).map((t) => {
                  const v = patterns!.timeBuckets[t] ?? 0;
                  const tot = Object.values(patterns!.timeBuckets).reduce((s, n) => s + (n as number), 0) || 1;
                  return (
                    <div key={t} className="time-col">
                      <div className="time-bar-wrap">
                        <div className="time-bar" style={{ height: `${(v / tot) * 100}%` }} />
                      </div>
                      <div className="time-label">{t[0].toUpperCase() + t.slice(1, 3)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
