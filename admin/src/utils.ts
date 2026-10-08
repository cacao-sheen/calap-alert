import type { EvacCenter, IncidentStatus, IncidentType, SafetyStatus, Weather } from './types';

export const INCIDENT_INFO: Record<IncidentType, { label: string; emoji: string; color: string; bg: string }> = {
  flood: { label: 'Flood', emoji: '🌊', color: '#1d4ed8', bg: '#dbeafe' },
  fire: { label: 'Fire', emoji: '🔥', color: '#dc2626', bg: '#fee2e2' },
  car_accident: { label: 'Car Accident', emoji: '🚗', color: '#b45309', bg: '#fef3c7' },
  landslide: { label: 'Landslide', emoji: '⛰️', color: '#c2410c', bg: '#ffedd5' },
  medical: { label: 'Medical', emoji: '🩺', color: '#be185d', bg: '#fce7f3' },
  power_outage: { label: 'Power Outage', emoji: '⚡', color: '#a16207', bg: '#fef9c3' },
  fallen_tree: { label: 'Fallen Tree', emoji: '🌳', color: '#15803d', bg: '#dcfce7' },
  other: { label: 'Other', emoji: '❗', color: '#475569', bg: '#f1f5f9' },
};

// `color` is an Ionic color name (see theme/variables.css)
export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'danger' },
  verified: { label: 'Verified', color: 'primary' },
  responding: { label: 'Responding', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
};

export const SAFETY: Record<SafetyStatus, { label: string; color: string; hex: string }> = {
  safe: { label: 'Safe', color: 'success', hex: '#16a34a' },
  evacuated: { label: 'Evacuated', color: 'primary', hex: '#2563eb' },
  need_help: { label: 'Needs help', color: 'tertiary', hex: '#9333ea' },
  unaccounted: { label: 'Unaccounted', color: 'danger', hex: '#dc2626' },
};

export function centerState(c: EvacCenter) {
  if (!c.isOpen) return { label: 'Closed', color: 'medium', bar: '#94a3b8' };
  const p = c.currentOccupancy / c.capacity;
  if (p >= 1) return { label: 'Full', color: 'danger', bar: '#dc2626' };
  if (p >= 0.8) return { label: 'Almost full', color: 'warning', bar: '#f59e0b' };
  return { label: 'Available', color: 'success', bar: '#16a34a' };
}

export const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '0%');
export const fmt = (n: number) => n.toLocaleString('en-US');
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : new Date(iso).toLocaleDateString();
}

export function weatherText(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 64) return 'Rain';
  if (code <= 67) return 'Heavy rain';
  if (code <= 82) return 'Rain showers';
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

// Reads ?key=value from the current URL (used when a page is opened from a link)
export const urlParam = (key: string) => new URLSearchParams(window.location.search).get(key);
