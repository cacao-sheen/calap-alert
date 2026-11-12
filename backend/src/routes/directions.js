import { Router } from 'express';
import { httpError } from '../http.js';

const router = Router();

// Walking route along real streets, from the free OpenStreetMap routing server (FOSSGIS OSRM, no API key).
// Cached so many people walking to the same center from about the same spot ask only once.
const cache = new Map();

function point(value) {
  const [lat, lng] = String(value ?? '').split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw httpError(400, 'Use ?from=lat,lng&to=lat,lng');
  return { lat, lng };
}

// GET /api/directions?from=13.41,121.18&to=13.42,121.19
router.get('/', async (req, res) => {
  const from = point(req.query.from);
  const to = point(req.query.to);
  const key = [from.lat.toFixed(4), from.lng.toFixed(4), to.lat.toFixed(5), to.lng.toFixed(5)].join();
  if (cache.has(key)) return res.json(cache.get(key));

  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}`
    + '?overview=full&geometries=geojson';
  let data;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'CalapAlert-school-project/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    data = await resp.json();
  } catch {
    throw httpError(502, 'Could not get directions right now');
  }
  const route = data?.routes?.[0];
  if (data?.code !== 'Ok' || !route) throw httpError(502, 'No walking route found');

  const result = {
    // The route starts and ends on the nearest street, so connect it to the exact spots
    coordinates: [[from.lng, from.lat], ...route.geometry.coordinates, [to.lng, to.lat]],
    distanceM: Math.round(route.distance),
    durationS: Math.round(route.duration),
  };
  if (cache.size > 500) cache.clear();
  cache.set(key, result);
  res.json(result);
});

export default router;
