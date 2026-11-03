import { Router } from 'express';
import { httpError } from '../http.js';

const router = Router();

// Calapan City. Weather comes from Open-Meteo (free, no API key needed).
// Open-Meteo limits requests per internet address, and free hosts like Render share one address with
// many apps, so it often answers 429 there. Then we use MET Norway (also free, no key) instead.
const LAT = 13.4117;
const LNG = 121.1803;
const CACHE_MS = 10 * 60 * 1000;
const USER_AGENT = 'CalapAlert-school-project/1.0 github.com/cacao-sheen/calap-alert';
let cache = { at: 0, data: null };

async function fromOpenMeteo() {
  const params = new URLSearchParams({
    latitude: LAT,
    longitude: LNG,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    forecast_hours: 12,
    timezone: 'Asia/Manila',
  });
  const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`Open-Meteo responded ${resp.status}`);
  const j = await resp.json();
  const hourly = j.hourly.time.map((time, i) => ({
    time,
    temperature: j.hourly.temperature_2m[i],
    rainChance: j.hourly.precipitation_probability[i],
    weatherCode: j.hourly.weather_code[i],
  }));
  return {
    location: 'Calapan City',
    updatedAt: j.current.time,
    temperature: j.current.temperature_2m,
    feelsLike: j.current.apparent_temperature,
    humidity: j.current.relative_humidity_2m,
    precipitation: j.current.precipitation,
    windSpeed: j.current.wind_speed_10m,
    windGusts: j.current.wind_gusts_10m,
    weatherCode: j.current.weather_code,
    rainChance: hourly[0]?.rainChance ?? null,
    hourly,
    source: 'Open-Meteo',
  };
}

// MET Norway describes the sky with words (e.g. "heavyrainshowers_day"); turn them into the same
// WMO weather codes Open-Meteo uses, so the apps don't need to know which source answered.
function wmoCode(symbol = '') {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 95;
  if (s.includes('snow') || s.includes('sleet')) return 71;
  if (s === 'heavyrainshowers') return 82;
  if (s === 'rainshowers') return 81;
  if (s === 'lightrainshowers') return 80;
  if (s === 'heavyrain') return 65;
  if (s === 'rain') return 63;
  if (s === 'lightrain') return 61;
  if (s === 'fog') return 45;
  if (s === 'cloudy') return 3;
  if (s === 'partlycloudy') return 2;
  if (s === 'fair') return 1;
  return 0;
}

async function fromMetNorway() {
  const resp = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${LAT}&lon=${LNG}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`MET Norway responded ${resp.status}`);
  const steps = (await resp.json()).properties.timeseries;
  // The first step is the current hour
  const now = steps[0];
  const d = now.data.instant.details;
  const kmh = (ms) => Math.round(ms * 3.6 * 10) / 10;
  return {
    location: 'Calapan City',
    updatedAt: now.time,
    temperature: d.air_temperature,
    feelsLike: d.apparent_air_temperature ?? d.air_temperature,
    humidity: d.relative_humidity,
    precipitation: now.data.next_1_hours?.details?.precipitation_amount ?? 0,
    windSpeed: kmh(d.wind_speed),
    windGusts: null, // MET Norway has no gusts or rain chance for the Philippines
    weatherCode: wmoCode(now.data.next_1_hours?.summary?.symbol_code),
    rainChance: null,
    hourly: steps.slice(0, 12).map((s) => ({
      time: s.time,
      temperature: s.data.instant.details.air_temperature,
      rainChance: null,
      weatherCode: wmoCode(s.data.next_1_hours?.summary?.symbol_code),
    })),
    source: 'MET Norway',
  };
}

async function getWeather() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  for (const source of [fromOpenMeteo, fromMetNorway]) {
    try {
      const data = await source();
      cache = { at: Date.now(), data };
      return data;
    } catch (err) {
      console.warn('Weather fetch failed:', err.message);
    }
  }
  // Show the last known weather rather than nothing
  if (cache.data) return { ...cache.data, stale: true };
  throw httpError(502, 'Weather service is unavailable right now');
}

router.get('/', async (req, res) => {
  res.json(await getWeather());
});

// ---- Live weather event for the dashboard banner: a real tropical cyclone near the Philippines, else rain ----

// GDACS (UN/EU disaster alert system) lists current tropical cyclones worldwide, free and without a key.
const EVENT_CACHE_MS = 15 * 60 * 1000;
let tcCache = { at: 0, list: [] };

async function currentCyclones() {
  if (Date.now() - tcCache.at < EVENT_CACHE_MS) return tcCache.list;
  try {
    const resp = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC', { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`GDACS responded ${resp.status}`);
    const { features = [] } = await resp.json();
    // Roughly the Philippine Area of Responsibility, or any storm GDACS says affects the Philippines
    const list = features.filter((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const inPar = lat >= 4 && lat <= 27 && lng >= 114 && lng <= 136;
      const hitsPh = (p.affectedcountries ?? []).some((c) => c.iso3 === 'PHL');
      return String(p.iscurrent) === 'true' && (inPar || hitsPh);
    });
    tcCache = { at: Date.now(), list };
  } catch (err) {
    console.warn('Cyclone fetch failed:', err.message);
    tcCache = { at: Date.now() - EVENT_CACHE_MS + 60_000, list: tcCache.list }; // retry in a minute
  }
  return tcCache.list;
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
// PAGASA-style rain intensity from mm per hour
function rainLevel(mm, code) {
  if (mm >= 30) return 'Torrential rain';
  if (mm >= 15) return 'Intense rain';
  if (mm >= 7.5 || [65, 82, 95, 96, 99].includes(code)) return 'Heavy rain';
  if (mm >= 2.5 || [63, 81].includes(code)) return 'Moderate rain';
  return 'Light rain';
}

router.get('/event', async (req, res) => {
  const [cyclones, w] = await Promise.all([
    currentCyclones(),
    getWeather().catch(() => null),
  ]);

  const storm = cyclones.map((f) => f.properties).sort((a, b) => b.alertscore - a.alertscore)[0];
  if (storm) {
    return res.json({
      kind: 'typhoon',
      title: `Tropical Cyclone ${storm.eventname}`,
      description: `${storm.severitydata?.severitytext ?? storm.htmldescription}. Affects: ${storm.country}. Alert level: ${storm.alertlevel}.`,
      source: 'GDACS / JTWC',
      url: storm.url?.report ?? null,
      updatedAt: storm.datemodified,
    });
  }

  if (w && (RAIN_CODES.has(w.weatherCode) || w.precipitation > 0)) {
    const level = rainLevel(w.precipitation, w.weatherCode);
    return res.json({
      kind: 'rain',
      title: `${level} in Calapan City`,
      description: `${w.precipitation} mm of rain in the last hour · wind ${Math.round(w.windSpeed)} km/h, gusts ${w.windGusts == null ? '—' : `${Math.round(w.windGusts)} km/h`} · rain chance ${w.rainChance == null ? '—' : `${w.rainChance}%`}.`,
      source: 'Open-Meteo',
      url: null,
      updatedAt: w.updatedAt,
    });
  }

  res.json({
    kind: 'none',
    title: 'No typhoon or rain right now',
    description: !w ? 'Weather service is unavailable right now.'
      : w.rainChance == null ? 'No rain at the moment in Calapan City.'
      : `No rain at the moment in Calapan City · ${w.rainChance}% chance of rain in the next hour.`,
    source: 'GDACS / Open-Meteo',
    url: null,
    updatedAt: w?.updatedAt ?? null,
  });
});

export default router;
