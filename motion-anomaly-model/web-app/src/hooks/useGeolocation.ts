import { useEffect, useState } from 'react';

export type Coords = { lat: number; lng: number; accuracy?: number };

export function useGeolocation(enabled: boolean) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported in this browser.');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { coords, error };
}
