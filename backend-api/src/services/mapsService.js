import { env } from '../config/env.js';

async function googleRoutes(from, to) {
  if (!env.googleMapsApiKey) {
    throw new Error('Google Maps not configured: set GOOGLE_MAPS_API_KEY');
  }
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${from.lat},${from.lng}`);
  url.searchParams.set('destination', `${to.lat},${to.lng}`);
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('mode', 'walking');
  url.searchParams.set('key', env.googleMapsApiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Directions failed: ${res.status}`);
  }
  const json = await res.json();
  if (json.status !== 'OK') {
    throw new Error(`Google Directions status ${json.status}: ${json.error_message ?? ''}`);
  }
  return json.routes.map((r, i) => ({
    id: `g-${i}`,
    summary: r.summary,
    distanceMeters: r.legs.reduce((s, l) => s + l.distance.value, 0),
    durationSeconds: r.legs.reduce((s, l) => s + l.duration.value, 0),
    polyline: r.overview_polyline?.points,
    waypoints: r.legs.flatMap((l) => l.steps.map((s) => ({
      lat: s.end_location.lat,
      lng: s.end_location.lng,
    }))),
  }));
}

async function osrmRoutes(from, to) {
  const url = `${env.osrmBaseUrl}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?alternatives=true&geometries=geojson&overview=full&steps=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM failed: ${res.status}`);
  }
  const json = await res.json();
  if (json.code !== 'Ok') {
    throw new Error(`OSRM status ${json.code}`);
  }
  return json.routes.map((r, i) => {
    const coords = r.geometry?.coordinates ?? [];
    return {
      id: `o-${i}`,
      summary: `Route ${i + 1}`,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      geometry: r.geometry,
      waypoints: coords.map(([lng, lat]) => ({ lat, lng })),
    };
  });
}

export async function fetchRoutes(from, to) {
  switch (env.mapsProvider) {
    case 'google': return googleRoutes(from, to);
    case 'osrm': return osrmRoutes(from, to);
    default: throw new Error(`Unknown MAPS_PROVIDER: ${env.mapsProvider}`);
  }
}

async function googleGeocode(query) {
  if (!env.googleMapsApiKey) {
    throw new Error('Google Maps not configured: set GOOGLE_MAPS_API_KEY');
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', env.googleMapsApiKey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Geocoding failed: ${res.status}`);
  const json = await res.json();
  return json.results?.map((r) => ({
    label: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  })) ?? [];
}

async function osrmGeocode(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  const res = await fetch(url, { headers: { 'User-Agent': 'saferoute-plus/0.1' } });
  if (!res.ok) throw new Error(`Nominatim failed: ${res.status}`);
  const json = await res.json();
  return json.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

export async function geocode(query) {
  switch (env.mapsProvider) {
    case 'google': return googleGeocode(query);
    case 'osrm': return osrmGeocode(query);
    default: throw new Error(`Unknown MAPS_PROVIDER: ${env.mapsProvider}`);
  }
}
