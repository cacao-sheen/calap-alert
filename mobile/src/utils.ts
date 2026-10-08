import {
  alertCircleOutline, carOutline, ellipsisHorizontal, flameOutline, flashOutline, leafOutline,
  medkitOutline, trailSignOutline, waterOutline,
} from 'ionicons/icons';
import type { EvacCenter, IncidentType, SafetyStatus, Weather } from './types';

// Center of Brgy. Ibaba East / West area (sample). Used when GPS is not available.
export const DEFAULT_LOCATION = { lat: 13.4135, lng: 121.18 };

export const INCIDENT_TYPES: { type: IncidentType; label: string; icon: string; color: string; bg: string; emoji: string }[] = [
  { type: 'car_accident', label: 'Car Accident', icon: carOutline, color: '#b45309', bg: '#fef3c7', emoji: '🚗' },
  { type: 'fire', label: 'Fire', icon: flameOutline, color: '#dc2626', bg: '#fee2e2', emoji: '🔥' },
  { type: 'flood', label: 'Flood', icon: waterOutline, color: '#1d4ed8', bg: '#dbeafe', emoji: '🌊' },
  { type: 'landslide', label: 'Landslide', icon: trailSignOutline, color: '#c2410c', bg: '#ffedd5', emoji: '⛰️' },
  { type: 'medical', label: 'Medical', icon: medkitOutline, color: '#be185d', bg: '#fce7f3', emoji: '🩺' },
  { type: 'power_outage', label: 'Power Outage', icon: flashOutline, color: '#a16207', bg: '#fef9c3', emoji: '⚡' },
  { type: 'fallen_tree', label: 'Fallen Tree', icon: leafOutline, color: '#15803d', bg: '#dcfce7', emoji: '🌳' },
  { type: 'other', label: 'Other', icon: ellipsisHorizontal, color: '#475569', bg: '#f1f5f9', emoji: '❗' },
];
export const incidentInfo = (t: IncidentType) => INCIDENT_TYPES.find((x) => x.type === t) ?? INCIDENT_TYPES[7];
export const fallbackIcon = alertCircleOutline;

export const STATUS_LABEL: Record<SafetyStatus, string> = {
  safe: 'Safe',
  evacuated: 'Evacuated',
  need_help: 'Needs help',
  unaccounted: 'Not checked in',
};
export const STATUS_COLOR: Record<SafetyStatus, string> = {
  safe: 'success',
  evacuated: 'primary',
  need_help: 'danger',
  unaccounted: 'medium',
};

// Open-Meteo / WMO weather codes
export function weatherText(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 65) return code >= 65 ? 'Heavy rain' : 'Rain';
  if (code <= 67) return 'Freezing rain';
  if (code <= 77) return 'Snow';
  if (code <= 81) return 'Rain showers';
  if (code === 82) return 'Violent rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

// One-line summary of the most important live weather, for the alert banners
export function weatherHeadline(w: Weather): string {
  const parts = [`${weatherText(w.weatherCode)} ${Math.round(w.temperature)}°C`];
  parts.push(`Wind ${Math.round(w.windSpeed)} km/h (gusts ${Math.round(w.windGusts)})`);
  if (w.rainChance != null) parts.push(`Rain chance ${w.rainChance}%`);
  const warn = w.weatherCode >= 95 ? 'Thunderstorm' : w.windGusts >= 60 ? 'Strong winds' : w.weatherCode >= 65 ? 'Heavy rain' : '';
  return `${warn ? `⚠ ${warn} · ` : ''}${parts.join(' · ')}`;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export const walkMinutes = (km: number) => Math.max(1, Math.round((km / 4.5) * 60));

export function centerStatus(c: EvacCenter): { label: string; color: string; bar: string } {
  if (!c.isOpen) return { label: 'Closed', color: 'medium', bar: '#94a3b8' };
  const pct = c.currentOccupancy / c.capacity;
  if (pct >= 1) return { label: 'Full', color: 'danger', bar: '#dc2626' };
  if (pct >= 0.8) return { label: 'Almost full', color: 'warning', bar: '#f59e0b' };
  return { label: 'Available', color: 'success', bar: '#16a34a' };
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Current GPS position, or the default Ibaba location if permission is denied.
export function getLocation(): Promise<{ lat: number; lng: number; fromGps: boolean }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ...DEFAULT_LOCATION, fromGps: false });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, fromGps: true }),
      () => resolve({ ...DEFAULT_LOCATION, fromGps: false }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

// Shrinks a photo so it uploads quickly (max 1024px, JPEG).
export function resizeImage(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

// Compass direction (0-360, 0 = north) from point a to point b
export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLng = (b.lng - a.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(dLng);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

// iOS only lets a page read the compass after the user taps something and agrees. Android needs nothing.
export async function allowCompass(): Promise<void> {
  const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  if (typeof D.requestPermission === 'function') {
    try { await D.requestPermission(); } catch { /* the Live View shows a message if there is no compass */ }
  }
}
