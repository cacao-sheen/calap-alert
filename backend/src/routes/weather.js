import { Router } from 'express';
import { httpError } from '../http.js';

const router = Router();

// Calapan City. Weather comes from Open-Meteo (free, no API key needed).
const LAT = 13.4117;
const LNG = 121.1803;
const CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, data: null };

router.get('/', async (req, res) => {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return res.json(cache.data);

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
    if (cache.data) return res.json({ ...cache.data, stale: true });
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
  res.json(data);
});

export default router;
