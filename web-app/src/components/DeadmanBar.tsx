import './DeadmanBar.css';

export default function DeadmanBar({
  remainingSeconds,
  totalSeconds,
  status,
  onCheckin,
}: {
  remainingSeconds: number;
  totalSeconds: number;
  status: 'active' | 'sos' | 'ended';
  onCheckin: () => void;
}) {
  const pct = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100));
  const tone = status === 'sos' ? 'alert' : remainingSeconds <= 20 ? 'warn' : 'safe';

  return (
    <div className={`deadman deadman-${tone}`}>
      <div className="deadman-head">
        <div>
          <p className="deadman-label">Next check-in in</p>
          <p className="deadman-time">{remainingSeconds}s</p>
        </div>
        <button
          className="btn btn-secondary deadman-btn"
          onClick={onCheckin}
          disabled={status === 'ended'}
        >
          I'm OK
        </button>
      </div>
      <div className="deadman-track" aria-hidden="true">
        <div className="deadman-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
