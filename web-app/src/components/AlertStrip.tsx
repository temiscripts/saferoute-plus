import { Link } from 'react-router-dom';
import type { Report } from '../api/reports';
import './AlertStrip.css';

function formatRelative(ts: number) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AlertStrip({ report }: { report: Report | null }) {
  if (!report) return null;
  return (
    <Link to="/home" className="alert-strip">
      <span className="alert-dot" aria-hidden="true" />
      <span className="alert-text">
        <strong>{(report.category ?? 'incident').replace(/_/g, ' ')}</strong>
        <span> · {formatRelative(report.created_at)} · </span>
        <span className="alert-desc">{report.description}</span>
      </span>
    </Link>
  );
}
