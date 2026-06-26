import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Report } from '../api/reports';
import { colors } from '../theme/tokens';
import './MapView.css';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [6.5244, 3.3792];

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapView({
  reports,
  clusters,
  center = DEFAULT_CENTER,
  height = 360,
}: {
  reports: Report[];
  clusters?: { lat: number; lng: number; count: number }[];
  center?: [number, number];
  height?: number | string;
}) {
  return (
    <div className="map-view" style={{ height }}>
      <MapContainer center={center} zoom={14} className="map-canvas" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        {clusters?.map((c, i) => (
          <CircleMarker
            key={`cluster-${i}`}
            center={[c.lat, c.lng]}
            radius={Math.max(10, Math.min(30, c.count * 6))}
            pathOptions={{
              color: colors.navy,
              fillColor: colors.navy,
              fillOpacity: 0.18,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{c.count} reports</strong> near this location
            </Popup>
          </CircleMarker>
        ))}
        {reports.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={8}
            pathOptions={{
              color: colors.terracotta,
              fillColor: colors.terracotta,
              fillOpacity: 0.6,
              weight: 1.5,
            }}
          >
            <Popup>
              <strong>{r.category ?? 'incident'}</strong>
              <br />
              <span>{r.description}</span>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
