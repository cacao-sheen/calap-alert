import { Router } from 'express';
import { httpError } from '../http.js';

const router = Router();

// Calapan City. Weather comes from Open-Meteo (free, no API key needed).
const LAT = 13.4117;
const LNG = 121.1803;
const CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, data: null };

async function getWeather() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const params = new URLSearchParams({
    latitude: LAT,
    longitude: LNG,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    forecast_hours: 12,
    timezone: 'Asia/Manila',
  });
  let j;
  try {
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) throw new Error(`Open-Meteo responded ${resp.status}`);
    j = await resp.json();
  } catch (err) {
    console.warn('Weather fetch failed:', err.message);
    // Show the last known weather rather than nothing
    if (cache.data) return { ...cache.data, stale: true };
    throw httpError(502, 'Weather service is unavailable right now');
  }

  const hourly = j.hourly.time.map((time, i) => ({
    time,
    temperature: j.hourly.temperature_2m[i],
    rainChance: j.hourly.precipitation_probability[i],
    weatherCode: j.hourly.weather_code[i],
  }));
  const data = {
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
  cache = { at: Date.now(), data };
  return data;
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
      description: `${w.precipitation} mm of rain in the last hour · wind ${Math.round(w.windSpeed)} km/h, gusts ${Math.round(w.windGusts)} km/h · rain chance ${w.rainChance ?? '—'}%.`,
      source: 'Open-Meteo',
      url: null,
      updatedAt: w.updatedAt,
    });
  }

  res.json({
    kind: 'none',
    title: 'No typhoon or rain right now',
    description: w ? `No rain at the moment in Calapan City · ${w.rainChance ?? '—'}% chance of rain in the next hour.` : 'Weather service is unavailable right now.',
    source: 'GDACS / Open-Meteo',
    url: null,
    updatedAt: w?.updatedAt ?? null,
  });
});

export default router;
