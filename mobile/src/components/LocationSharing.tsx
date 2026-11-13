import { useEffect } from 'react';
import { api } from '../api';
import { getLocation } from '../utils';

// "Share my location" on the My Safety page. On by default, like before.
export const isSharingLocation = () => localStorage.getItem('shareLocation') !== 'false';

// Sends where I am now, so CDRRMO sees me on their Live Map. Does nothing when sharing is off,
// or when the phone has no GPS fix (a made-up default spot would mislead responders).
export async function sendMyLocation() {
  if (!isSharingLocation()) return;
  const here = await getLocation();
  if (!here.fromGps || !isSharingLocation()) return;
  await api('/locations/me', { method: 'POST', body: { lat: here.lat, lng: here.lng, accuracy: here.accuracy } }).catch(() => {});
}

// Turning sharing off also deletes my last spot from the server
export async function stopSharingLocation() {
  await api('/locations/me', { method: 'DELETE' }).catch(() => {});
}

// While the app is open: send my spot now, every 2 minutes, and whenever the app comes back to the screen
export default function LocationSharing() {
  useEffect(() => {
    sendMyLocation();
    const timer = setInterval(sendMyLocation, 120_000);
    const onShow = () => {
      if (document.visibilityState === 'visible') sendMyLocation();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);
  return null;
}
