export type Barangay = { id: number; name: string };

export type DisasterEvent = {
  id: number;
  name: string;
  type: string;
  signalLevel: number | null;
  description: string | null;
  startedAt: string;
};

export type Weather = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  weatherCode: number;
  rainChance: number | null;
  updatedAt: string;
  hourly: { time: string; temperature: number; rainChance: number; weatherCode: number }[];
  source: string;
};

export type BarangayStats = {
  id: number;
  name: string;
  households: number;
  total: number;
  safe: number;
  evacuated: number;
  needHelp: number;
  unaccounted: number;
  vulnerableAtRisk: number;
};

export type Summary = {
  event: DisasterEvent | null;
  totals: {
    residents: number;
    households: number;
    safe: number;
    evacuated: number;
    needHelp: number;
    unaccounted: number;
    activeIncidents: number;
  };
  barangays: BarangayStats[];
  incidentsByType: { type: IncidentType; n: number }[];
  centers: { open: number; capacity: number; occupancy: number };
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
  updatedAt: string;
};

export type IncidentType =
  | 'flood' | 'fire' | 'car_accident' | 'landslide' | 'medical' | 'power_outage' | 'fallen_tree' | 'other';
export type IncidentStatus = 'pending' | 'verified' | 'responding' | 'resolved';

export type Incident = {
  id: number;
  code: string;
  type: IncidentType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: IncidentStatus;
  lat: number | null;
  lng: number | null;
  address: string | null;
  barangayId: number | null;
  barangay: string | null;
  reporterName: string | null;
  hasPhoto: boolean;
  createdAt: string;
};

export type IncidentDetail = Incident & {
  photo: string | null;
  updates: { id: number; status: IncidentStatus; note: string | null; createdAt: string; byName: string | null }[];
};

export type SafetyStatus = 'safe' | 'evacuated' | 'need_help' | 'unaccounted';

export type Resident = {
  id: number;
  residentCode: string | null;
  firstName: string;
  lastName: string;
  age: number | null;
  sex: string | null;
  contactNumber: string | null;
  barangayId: number;
  barangay: string;
  relationship: string | null;
  purok: string | null;
  address: string | null;
  isPwd: boolean;
  status: SafetyStatus;
  checkedInAt: string | null;
  centerName: string | null;
};

export type ResidentPage = {
  items: Resident[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<'all' | SafetyStatus, number>;
};
