import type { Patterns } from '../api/patterns';
import './StatsDashboard.css';

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="delta delta-flat">no change</span>;
  if (value > 0) return <span className="delta delta-up">+{value} vs last week</span>;
  return <span className="delta delta-down">{value} vs last week</span>;
}

export default function StatsDashboard({ data }: { data: Patterns | null }) {
  if (!data) {
    return (
      <section className="stats-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat-card surface skeleton" />
        ))}
      </section>
    );
  }

  return (
    <section className="stats-grid">
      <div className="stat-card surface">
        <p className="stat-label">Reports this week</p>
        <p className="stat-value">{data.deltas.reportsLastWeek}</p>
        <Delta value={data.deltas.reportsLastWeekDelta} />
      </div>
      <div className="stat-card surface">
        <p className="stat-label">High-severity reports</p>
        <p className="stat-value">{data.deltas.severeLastWeek}</p>
        <Delta value={data.deltas.severeLastWeekDelta} />
      </div>
      <div className="stat-card surface">
        <p className="stat-label">Total in last 6 months</p>
        <p className="stat-value">{data.totalReports}</p>
        <span className="delta delta-flat">{data.topCategories[0]?.category ?? 'no data'} leading</span>
      </div>
    </section>
  );
}
