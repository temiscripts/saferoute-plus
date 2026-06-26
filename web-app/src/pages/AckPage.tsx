import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { colors } from '../theme/tokens';
import './AckPage.css';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type SessionSnap = {
  id: string;
  status: string;
  user_name: string;
  started_at: number;
  sos_triggered_at: number | null;
  ended_at: number | null;
};

type LocationPoint = { lat: number; lng: number; recorded_at: number };

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      map.setView(center, 15);
      first.current = false;
    } else {
      map.flyTo(center, map.getZoom(), { animate: true, duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

function StatusChip({ session }: { session: SessionSnap }) {
  if (session.ended_at) return <span className="ack-status-chip chip-ended">Session ended</span>;
  if (session.sos_triggered_at) return <span className="ack-status-chip chip-sos">SOS active</span>;
  return <span className="ack-status-chip chip-active">Active session</span>;
}

export default function AckPage() {
  const { token } = useParams<{ token: string }>();
  const [ackStatus, setAckStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [ackError, setAckError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSnap | null>(null);
  const [locations, setLocations] = useState<LocationPoint[]>([]);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/escalation/ack/${token}`, { method: 'POST' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.code ?? 'unknown');
        setAckStatus('ok');
      })
      .catch((err: Error) => {
        const code = err.message;
        if (code === 'already_acked' || code === 'already_resolved' || code === 'no_active_escalation') {
          setAckStatus('ok');
        } else {
          setAckStatus('error');
          setAckError(code);
        }
      });

    const es = new EventSource(`/api/escalation/stream/${token}`);

    es.addEventListener('snapshot', (e: MessageEvent) => {
      const { session: snap } = JSON.parse(e.data) as { session: SessionSnap };
      setSession(snap);
    });

    es.addEventListener('location', (e: MessageEvent) => {
      const loc = JSON.parse(e.data) as LocationPoint;
      setLocations((prev) => [...prev, loc]);
    });

    es.addEventListener('session_ended', (e: MessageEvent) => {
      const snap = JSON.parse(e.data) as SessionSnap;
      setSession(snap);
      setEnded(true);
      es.close();
    });

    es.onerror = () => {};

    return () => es.close();
  }, [token]);

  const latestLoc = locations[locations.length - 1];
  const mapCenter: [number, number] = latestLoc
    ? [latestLoc.lat, latestLoc.lng]
    : [6.5244, 3.3792];

  return (
    <div className="ack-page">
      <div className="ack-header">
        <h1>{session ? `${session.user_name} needs help` : 'Loading…'}</h1>
        {ackStatus === 'pending' && (
          <span className="ack-badge ack-badge-pending">Confirming your response…</span>
        )}
        {ackStatus === 'ok' && (
          <span className="ack-badge ack-badge-ok">Your response was received</span>
        )}
        {ackStatus === 'error' && (
          <span className="ack-badge ack-badge-error">
            {ackError === 'invalid_token' ? 'This link is invalid or expired.' : `Error: ${ackError}`}
          </span>
        )}
      </div>

      {session && (
        <div className="ack-session-card">
          <div className="ack-session-row">
            <span className="ack-session-label">Person</span>
            <span className="ack-session-value">{session.user_name}</span>
          </div>
          <div className="ack-session-row">
            <span className="ack-session-label">Status</span>
            <StatusChip session={session} />
          </div>
          {session.sos_triggered_at && (
            <div className="ack-session-row">
              <span className="ack-session-label">SOS triggered</span>
              <span className="ack-session-value">{formatTime(session.sos_triggered_at)}</span>
            </div>
          )}
        </div>
      )}

      {latestLoc ? (
        <div className="ack-map-wrap">
          <MapContainer
            center={mapCenter}
            zoom={15}
            className="ack-map-canvas"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyTo center={mapCenter} />
            {locations.map((loc, i) => (
              <CircleMarker
                key={loc.recorded_at}
                center={[loc.lat, loc.lng]}
                radius={i === locations.length - 1 ? 10 : 5}
                pathOptions={{
                  color: colors.terracotta,
                  fillColor: colors.terracotta,
                  fillOpacity: i === locations.length - 1 ? 0.85 : 0.35,
                  weight: i === locations.length - 1 ? 2 : 1,
                }}
              >
                <Popup>
                  {i === locations.length - 1 ? 'Latest position' : 'Earlier position'}{' '}
                  · {formatTime(loc.recorded_at)}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div className="ack-no-location">
          {ended
            ? 'No location data was recorded for this session.'
            : <><span className="ack-live-dot" />Waiting for live location…</>}
        </div>
      )}

      {ended ? (
        <p className="ack-ended-notice">
          This session has ended. The map shows the last known location trail.
        </p>
      ) : (
        !ended && latestLoc && (
          <p className="muted small">
            <span className="ack-live-dot" />
            Live — updating every few seconds. Last seen {formatTime(latestLoc.recorded_at)}.
          </p>
        )
      )}
    </div>
  );
}
