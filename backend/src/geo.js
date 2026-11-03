// Where Brgy. Ibaba East and Ibaba West are. OpenStreetMap has no border shapes for them,
// only a center point each, so a spot counts as "in" a barangay when it is close to that center.
export const BARANGAY_CENTERS = [
  { name: 'Ibaba East', lat: 13.415, lng: 121.178 },
  { name: 'Ibaba West', lat: 13.4146, lng: 121.1761 },
];

// Both barangays are small (the two centers are only ~200 m apart). Farther than this = outside them.
export const BARANGAY_RADIUS_M = 450;

export const metersBetween = (aLat, aLng, bLat, bLng) =>
  Math.hypot((aLat - bLat) * 111_320, (aLng - bLng) * 111_320 * Math.cos((aLat * Math.PI) / 180));

export const nearestBarangay = (lat, lng) =>
  BARANGAY_CENTERS.reduce((a, b) => (metersBetween(lat, lng, a.lat, a.lng) <= metersBetween(lat, lng, b.lat, b.lng) ? a : b));

// Name of the barangay a spot is in, or null when it is outside Ibaba East & West
export function barangayAt(lat, lng) {
  const near = nearestBarangay(lat, lng);
  return metersBetween(lat, lng, near.lat, near.lng) <= BARANGAY_RADIUS_M ? near.name : null;
}
