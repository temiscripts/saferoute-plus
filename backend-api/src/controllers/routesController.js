import { z } from 'zod';
import { scoreRoutesBetween } from '../services/routeScoringService.js';
import { geocode } from '../services/mapsService.js';

export const scoreQuerySchema = z.object({
  fromLat: z.coerce.number().gte(-90).lte(90),
  fromLng: z.coerce.number().gte(-180).lte(180),
  toLat: z.coerce.number().gte(-90).lte(90),
  toLng: z.coerce.number().gte(-180).lte(180),
  hour: z.coerce.number().int().min(0).max(23).optional(),
});

export const geocodeQuerySchema = z.object({
  q: z.string().min(2).max(200),
});

export async function getScoredRoutes(req, res, next) {
  try {
    const q = req.validatedQuery;
    const routes = await scoreRoutesBetween(
      { lat: q.fromLat, lng: q.fromLng },
      { lat: q.toLat, lng: q.toLng },
      q.hour ?? new Date().getHours(),
    );
    res.json({ routes });
  } catch (err) {
    next(err);
  }
}

export async function getGeocode(req, res, next) {
  try {
    const results = await geocode(req.validatedQuery.q);
    res.json({ results });
  } catch (err) {
    next(err);
  }
}
