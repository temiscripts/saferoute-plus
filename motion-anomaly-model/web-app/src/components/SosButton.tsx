import './SosButton.css';

type Mode = 'idle' | 'active' | 'alert';

export default function SosButton({
  mode = 'idle',
  label = 'SOS',
  onClick,
  disabled,
}: {
  mode?: Mode;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`sos-button sos-${mode}`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Trigger SOS"
    >
      <span className="sos-pulse" aria-hidden="true" />
      <span className="sos-pulse sos-pulse-delayed" aria-hidden="true" />
      <span className="sos-core">{label}</span>
    </button>
  );
}
