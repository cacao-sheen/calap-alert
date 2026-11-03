import { Router } from 'express';
import { metersBetween, nearestBarangay } from '../geo.js';
import { httpError } from '../http.js';

const router = Router();

// Street name for a GPS point, from OpenStreetMap's Nominatim (free, no API key).
// Nominatim asks for a User-Agent and at most 1 request per second, so results are cached by ~11 m grid cell.
const cache = new Map();
let lastCall = 0;

// One Nominatim reverse lookup, waiting for our turn so we stay under 1 request per second (max ~4 s queue)
async function reverse(lat, lng, extra = {}) {
  const slot = Math.max(Date.now(), lastCall + 1000);
  if (slot - Date.now() > 4000) throw new Error('busy');
  lastCall = slot;
  await new Promise((r) => setTimeout(r, slot - Date.now()));

  const params = new URLSearchParams({ lat, lon: lng, format: 'jsonv2', zoom: 17, addressdetails: 1, ...extra });
  const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'User-Agent': 'CalapAlert-school-project/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!resp.ok) throw new Error(`Nominatim responded ${resp.status}`);
  return resp.json();
}

const roadOf = (j) => j?.address?.road ?? j?.address?.pedestrian ?? j?.address?.neighbourhood ?? null;

const cleanAddress = (street, lat, lng) =>
  [street, `Brgy. ${nearestBarangay(lat, lng).name}`, 'Calapan City'].filter(Boolean).join(', ');

// Photon (free OpenStreetMap search, built for search-as-you-type) knows named places and their streets
// much better than Nominatim does for Calapan.
async function photon(path, params) {
  const resp = await fetch(`https://photon.komoot.io/${path}?${new URLSearchParams(params)}`, {
    headers: { 'User-Agent': 'CalapAlert-school-project/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!resp.ok) throw new Error(`Photon responded ${resp.status}`);
  return (await resp.json()).features ?? [];
}

// Suggestions while the admin types in the "add evacuation center" search box
router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  try {
    const features = await photon('api/', {
      q, limit: 10, lat: 13.4135, lon: 121.18, bbox: '120.95,13.25,121.35,13.55',
    });
    const seen = new Set();
    const list = features
      .filter((f) => !f.properties.city || /calapan/i.test(f.properties.city))
      .map((f) => {
        const p = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        const area = p.locality ?? p.district ?? null;
        return {
          title: p.name ?? p.street ?? q,
          detail: [p.street, area].filter(Boolean).join(', '),
          kind: p.osm_value?.replace(/_/g, ' ') ?? '',
          address: cleanAddress(p.street ?? (p.osm_key === 'highway' ? p.name : null), lat, lng),
          barangay: nearestBarangay(lat, lng).name,
          lat,
          lng,
        };
      })
      .filter((r) => !seen.has(`${r.title}|${r.detail}`) && seen.add(`${r.title}|${r.detail}`))
      .slice(0, 6);
    res.json(list);
  } catch (err) {
    console.warn('Place search failed:', err.message);
    throw httpError(502, 'Place search is not available right now. Click on the map instead.');
  }
});

// Named things around a pin, closest first. Returns the first real place (school, hall, gym...) and a street.
async function lookAround(lat, lng) {
  const features = await photon('reverse', { lat, lon: lng, radius: 0.06, limit: 8 });
  const isPlace = (p) => p.name && !['highway', 'place', 'boundary', 'landuse'].includes(p.osm_key);
  const place = features.find((f) => isPlace(f.properties))?.properties;
  const street = place?.street
    ?? features.find((f) => f.properties.osm_key === 'highway')?.properties.name
    ?? features.find((f) => f.properties.street)?.properties.street
    ?? null;
  return { place: place?.name ?? null, street };
}

// ?places=1 (admin form) also looks for a named place right at the spot and builds a clean address
router.get('/', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw httpError(400, 'lat and lng are required');

  const places = req.query.places === '1';
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${places}`;
  if (cache.has(key)) return res.json(cache.get(key));

  try {
    let result;
    if (places) {
      // Only things within 60 m of the pin count, so the name is for the spot you clicked
      const { place, street } = await lookAround(lat, lng);
      result = { street, place, barangay: nearestBarangay(lat, lng).name, address: cleanAddress(street, lat, lng) };
    } else {
      result = { street: roadOf(await reverse(lat, lng)) };
    }

    if (cache.size > 500) cache.clear();
    cache.set(key, result);
    res.json(result);
  } catch (err) {
    console.warn('Street lookup failed:', err.message);
    res.json({ street: null });
  }
});

export default router;
