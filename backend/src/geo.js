// Barangays of Calapan City, and finding which one a GPS spot is in (from OpenStreetMap).

// All 62 barangays of Calapan City (official names). Brgy. Ibaba East and Ibaba West hold the test data.
export const CALAPAN_BARANGAYS = [
  'Balingayan', 'Balite', 'Baruyan', 'Batino', 'Bayanan I', 'Bayanan II', 'Biga', 'Bondoc', 'Bucayao', 'Buhuan',
  'Bulusan', 'Calero', 'Camansihan', 'Camilmil', 'Canubing I', 'Canubing II', 'Comunal', 'Guinobatan', 'Gulod', 'Gutad',
  'Ibaba East', 'Ibaba West', 'Ilaya', 'Lalud', 'Lazareto', 'Libis', 'Lumangbayan', 'Mahal na Pangalan', 'Maidlang', 'Malad',
  'Malamig', 'Managpi', 'Masipit', 'Nag-Iba I', 'Nag-Iba II', 'Navotas', 'Pachoca', 'Palhi', 'Panggalaan', 'Parang',
  'Patas', 'Personas', 'Putingtubig', 'Salong', 'San Antonio', 'San Vicente Central', 'San Vicente East', 'San Vicente North',
  'San Vicente South', 'San Vicente West', 'Santa Cruz', 'Santa Isabel', 'Santa Maria Village', 'Santa Rita', 'Santo Niño',
  'Sapul', 'Silonay', 'Suqui', 'Tawagan', 'Tawiran', 'Tibag', 'Wawa',
];

// OpenStreetMap writes names in different ways ("Sta. Cruz", "Bayanan 1", "Brgy. Lalud"), so compare simplified names
const simplify = (name) => String(name ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // ñ -> n
  .replace(/^(brgy\.?|barangay)\s+/, '')
  .replace(/\bsta\.?\s/g, 'santa ').replace(/\bsto\.?\s/g, 'santo ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b1\b/g, 'i').replace(/\b2\b/g, 'ii')
  .trim();
const BY_SIMPLE = new Map(CALAPAN_BARANGAYS.map((n) => [simplify(n), n]));

// Official barangay name for an OpenStreetMap name, or null if it is not a Calapan barangay
export const matchBarangay = (name) => BY_SIMPLE.get(simplify(name)) ?? null;

// One reverse lookup on OpenStreetMap's Nominatim (free, no API key). Nominatim asks for a User-Agent and
// at most 1 request per second, so calls wait for their turn (and give up if the queue is longer than ~4 s).
let lastCall = 0;
export async function reverseGeocode(lat, lng) {
  const slot = Math.max(Date.now(), lastCall + 1000);
  if (slot - Date.now() > 4000) throw new Error('busy');
  lastCall = slot;
  await new Promise((r) => setTimeout(r, slot - Date.now()));

  const params = new URLSearchParams({ lat, lon: lng, format: 'jsonv2', zoom: 17, addressdetails: 1 });
  const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'User-Agent': 'CalapAlert-school-project/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!resp.ok) throw new Error(`Nominatim responded ${resp.status}`);
  return resp.json();
}

// The Calapan barangay a spot is in, or null (outside Calapan, or OpenStreetMap doesn't say).
// The barangay can sit in different address fields; "quarter" is checked first because it is the most exact.
const cache = new Map();
export async function barangayAt(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  let found = null;
  try {
    const a = (await reverseGeocode(lat, lng)).address ?? {};
    if (/calapan/i.test(a.city ?? a.town ?? a.municipality ?? '')) {
      for (const field of ['quarter', 'village', 'suburb', 'hamlet', 'neighbourhood', 'city_district', 'residential']) {
        found = matchBarangay(a[field]);
        if (found) break;
      }
    }
  } catch {
    return null; // not cached, so the next try asks again
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, found);
  return found;
}
