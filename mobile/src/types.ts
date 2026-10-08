export type User = {
  id: number;
  email: string;
  role: 'admin' | 'resident';
  residentId: number | null;
  name?: string;
};

export type Barangay = { id: number; name: string; city: string };

export type Weather = {
  location: string;
  updatedAt: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  weatherCode: number;
  rainChance: number | null;
  hourly: { time: string; temperature: number; rainChance: number; weatherCode: number }[];
  source: string;
};

export type DisasterEvent = {
  id: number;
  name: string;
  type: string;
  signalLevel: number | null;
  description: string | null;
  startedAt: string;
};

export type Alert = {
  id: number;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'danger';
  barangay: string | null;
  createdAt: string;
};

export type EvacCenter = {
  id: number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  capacity: number;
  currentOccupancy: number;
  facilities: string[];
  isOpen: boolean;
  barangayId: number;
  barangay: string;
};

export type IncidentType =
  | 'flood' | 'fire' | 'car_accident' | 'landslide' | 'medical' | 'power_outage' | 'fallen_tree' | 'other';

export type Incident = {
  id: number;
  code: string;
  type: IncidentType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'verified' | 'responding' | 'resolved';
  lat: number | null;
  lng: number | null;
  address: string | null;
  barangay: string | null;
  reporterName: string | null;
  createdAt: string;
};

export type SafetyStatus = 'safe' | 'evacuated' | 'need_help' | 'unaccounted';

export type ResidentStatus = {
  id: number;
  firstName: string;
  lastName: string;
  age: number | null;
  relationship: string | null;
  barangay: string;
  status: SafetyStatus;
  checkedInAt: string | null;
  centerName: string | null;
};
