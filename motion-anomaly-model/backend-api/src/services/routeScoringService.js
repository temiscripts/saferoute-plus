import { db } from '../db/sqlite.js';
import { haversineMeters } from '../utils/geo.js';
import { fetchRoutes } from './mapsService.js';
import { nowSeconds } from '../utils/ids.js';

const PROXIMITY_METERS = 150;
const RECENCY_HALF_LIFE_DAYS = 30;
const NIGHT_HOURS = new Set([20, 21, 22, 23, 0, 1, 2, 3, 4, 5]);

const recentReports = db.prepare(`
  SELECT lat, lng, occurred_at, created_at
  FROM reports
  WHERE created_at > ?
`);

function recencyWeight(ageSeconds) {
  const ageDays = ageSeconds / 86400;
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

function timeOfDayWeight(reportTimestamp, hourOfTravel) {
  if (!reportTimestamp || hourOfTravel === undefined) return 1.0;
  const reportHour = new Date(reportTimestamp * 1000).getHours();
  const bothNight = NIGHT_HOURS.has(reportHour) && NIGHT_HOURS.has(hourOfTravel);
  const bothDay = !NIGHT_HOURS.has(reportHour) && !NIGHT_HOURS.has(hourOfTravel);
  return bothNight || bothDay ? 1.5 : 1.0;
}

function scoreRoute(route, reports, hourOfTravel) {
  const now = nowSeconds();
  let riskAccum = 0;
  let hits = 0;
  for (const wp of route.waypoints) {
    for (const r of reports) {
      const dist = haversineMeters(wp, { lat: r.lat, lng: r.lng });
      if (dist <= PROXIMITY_METERS) {
        const w = recencyWeight(now - r.created_at) * timeOfDayWeight(r.occurred_at, hourOfTravel);
        riskAccum += w;
        hits += 1;
      }
    }
  }
  const normalizedRisk = route.waypoints.length > 0 ? riskAccum / route.waypoints.length : 0;
  const safetyScore = Math.max(0, Math.min(100, 100 - normalizedRisk * 25));
  return {
    ...route,
    safetyScore: Math.round(safetyScore),
    nearbyReportHits: hits,
    riskFactor: Number(normalizedRisk.toFixed(3)),
  };
}

export async function scoreRoutesBetween(from, to, hourOfTravel) {
  const routes = await fetchRoutes(from, to);
  const cutoff = nowSeconds() - 365 * 86400;
  const reports = recentReports.all(cutoff);
  const scored = routes.map((r) => scoreRoute(r, reports, hourOfTravel));
  scored.sort((a, b) => b.safetyScore - a.safetyScore);
  return scored;
}
