import { db } from '../db/sqlite.js';
import { nowSeconds } from '../utils/ids.js';

const SEVERE_CATEGORIES = new Set(['assault', 'attempted_robbery', 'kidnapping', 'sexual_assault', 'critical']);

const allReports = db.prepare(`
  SELECT lat, lng, description, category, occurred_at, created_at
  FROM reports
  WHERE created_at >= ?
  ORDER BY created_at DESC
`);

const recentSevere = db.prepare(`
  SELECT id, lat, lng, description, category, occurred_at, created_at
  FROM reports
  WHERE created_at >= ?
    AND (category IS NOT NULL AND category IN ('assault','attempted_robbery','kidnapping','sexual_assault','critical'))
  ORDER BY created_at DESC
  LIMIT 1
`);

function bucketHour(ts) {
  if (!ts) return 'unknown';
  const h = new Date(ts * 1000).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function gridKey(lat, lng) {
  const f = (v) => Math.round(v * 1000) / 1000;
  return `${f(lat)},${f(lng)}`;
}

function monthKey(ts) {
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function aggregate(reports) {
  const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0, unknown: 0 };
  const categoryCounts = {};
  const locationCounts = {};
  const monthCounts = {};

  for (const r of reports) {
    timeBuckets[bucketHour(r.occurred_at ?? r.created_at)] += 1;
    const cat = r.category ?? 'uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    const gk = gridKey(r.lat, r.lng);
    locationCounts[gk] = (locationCounts[gk] ?? 0) + 1;
    const mk = monthKey(r.created_at);
    monthCounts[mk] = (monthCounts[mk] ?? 0) + 1;
  }

  const topLocations = Object.entries(locationCounts)
    .map(([key, count]) => {
      const [lat, lng] = key.split(',').map(Number);
      return { lat, lng, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const monthlyTrend = Object.entries(monthCounts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { timeBuckets, topLocations, topCategories, monthlyTrend };
}

function deltas(reports, now) {
  const sevenDays = 7 * 86400;
  const lastWeekStart = now - sevenDays;
  const priorWeekStart = now - 2 * sevenDays;

  let lastWeek = 0;
  let priorWeek = 0;
  let severeLastWeek = 0;
  let severePriorWeek = 0;

  for (const r of reports) {
    const isSevere = r.category && SEVERE_CATEGORIES.has(r.category);
    if (r.created_at >= lastWeekStart) {
      lastWeek += 1;
      if (isSevere) severeLastWeek += 1;
    } else if (r.created_at >= priorWeekStart) {
      priorWeek += 1;
      if (isSevere) severePriorWeek += 1;
    }
  }

  return {
    reportsLastWeek: lastWeek,
    reportsLastWeekDelta: lastWeek - priorWeek,
    severeLastWeek,
    severeLastWeekDelta: severeLastWeek - severePriorWeek,
  };
}

function insights(agg, d) {
  const out = [];
  const total = Object.values(agg.timeBuckets).reduce((s, n) => s + n, 0);
  if (total > 0) {
    const nightShare = Math.round((agg.timeBuckets.night / total) * 100);
    if (nightShare >= 30) {
      out.push(`${nightShare}% of reports happen at night (9pm–5am).`);
    }
    const eveningShare = Math.round((agg.timeBuckets.evening / total) * 100);
    if (eveningShare >= 30) {
      out.push(`${eveningShare}% of reports happen in the evening (5pm–9pm).`);
    }
  }
  if (agg.topLocations[0] && agg.topLocations[0].count >= 3) {
    out.push(`The most active hotspot has ${agg.topLocations[0].count} reports — see the safety map for its exact location.`);
  }
  if (agg.topCategories[0]) {
    out.push(`Most common report type: "${agg.topCategories[0].category}" (${agg.topCategories[0].count}).`);
  }
  if (d.reportsLastWeekDelta > 0) {
    out.push(`Reports are up ${d.reportsLastWeekDelta} this week vs last week.`);
  } else if (d.reportsLastWeekDelta < 0) {
    out.push(`Reports are down ${Math.abs(d.reportsLastWeekDelta)} this week vs last week.`);
  }
  return out;
}

export function getPatterns(_req, res) {
  const now = nowSeconds();
  const cutoff = now - 180 * 86400;
  const reports = allReports.all(cutoff);

  const agg = aggregate(reports);
  const d = deltas(reports, now);
  const recentSevereReport = recentSevere.get(now - 7 * 86400);

  res.json({
    generatedAt: now,
    totalReports: reports.length,
    deltas: d,
    timeBuckets: agg.timeBuckets,
    topLocations: agg.topLocations,
    topCategories: agg.topCategories,
    monthlyTrend: agg.monthlyTrend,
    insights: insights(agg, d),
    recentSevere: recentSevereReport ?? null,
    note: 'Computed by aggregation over /reports. When /report-clustering ships, this endpoint can be replaced or augmented with ML cluster output.',
  });
}
