import { IonButton, IonIcon, IonModal, IonSelect, IonSelectOption } from '@ionic/react';
import { arrowUp, close } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import type { EvacCenter } from '../types';
import { bearingDeg, distanceKm, formatDistance, walkMinutes } from '../utils';

const FIELD_OF_VIEW = 70; // rough horizontal view of a phone camera, in degrees
const ARRIVED_KM = 0.03;

type Point = { lat: number; lng: number };

// Compass direction the BACK camera faces. Works with the phone held upright or flat.
function cameraHeading(e: DeviceOrientationEvent): number | null {
  const ios = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
  if (typeof ios === 'number') return ios;
  // Android: only the "absolute" event is tied to north
  if (!e.absolute || e.alpha == null || e.beta == null || e.gamma == null) return null;
  const rad = Math.PI / 180;
  const [a, b, g] = [e.alpha * rad, e.beta * rad, e.gamma * rad];
  const x = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const y = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  return (Math.atan2(x, y) / rad + 360) % 360;
}

function Camera({ centers, firstId, onClose }: { centers: EvacCenter[]; firstId: number; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [targetId, setTargetId] = useState(firstId);
  const [me, setMe] = useState<Point | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [camError, setCamError] = useState('');

  // Camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Camera is not available here.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setCamError('Camera permission was denied. Allow the camera to use Live View.'));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // GPS
  useEffect(() => {
    const id = navigator.geolocation?.watchPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    return () => { if (id != null) navigator.geolocation.clearWatch(id); };
  }, []);

  // Compass (smoothed so the arrow does not shake)
  useEffect(() => {
    let current: number | null = null;
    const onTurn = (e: Event) => {
      const h = cameraHeading(e as DeviceOrientationEvent);
      if (h == null) return;
      if (current == null) current = h;
      else current = (current + ((((h - current + 540) % 360) - 180) * 0.25) + 360) % 360;
      setHeading(current);
    };
    window.addEventListener('deviceorientationabsolute', onTurn);
    window.addEventListener('deviceorientation', onTurn);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onTurn);
      window.removeEventListener('deviceorientation', onTurn);
    };
  }, []);

  const target = centers.find((c) => c.id === targetId) ?? centers[0];
  const km = me ? distanceKm(me, target) : null;
  // -180..180: negative = turn left, positive = turn right
  const turn = me && heading != null ? ((bearingDeg(me, target) - heading + 540) % 360) - 180 : null;
  const inView = turn != null && Math.abs(turn) < FIELD_OF_VIEW / 2;
  const arrived = km != null && km < ARRIVED_KM;

  let hint = '';
  if (camError) hint = camError;
  else if (!me) hint = 'Finding your location…';
  else if (heading == null) hint = 'No compass found. Open Live View on a phone.';
  else if (arrived) hint = "You're here!";
  else if (inView) hint = 'Keep going straight';
  else hint = turn! > 0 ? 'Turn right' : 'Turn left';

  return (
    <div className="live-view">
      <video ref={video} autoPlay playsInline muted />
      <div className="live-top">
        <IonSelect value={targetId} interface="popover" onIonChange={(e) => setTargetId(e.detail.value)} aria-label="Evacuation center">
          {centers.map((c) => <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>)}
        </IonSelect>
        <IonButton fill="clear" color="light" onClick={onClose} aria-label="Close"><IonIcon slot="icon-only" icon={close} /></IonButton>
      </div>

      {inView && !arrived && (
        <div className="live-pin" style={{ left: `${50 + (turn! / (FIELD_OF_VIEW / 2)) * 50}%` }}>
          <div className="live-pin-label">🏫 {target.name}<small>{formatDistance(km!)}</small></div>
          <div className="live-pin-stem" />
        </div>
      )}

      <div className="live-bottom">
        {turn != null && !arrived && (
          <div className="live-arrow" style={{ transform: `rotate(${turn}deg)` }}><IonIcon icon={arrowUp} /></div>
        )}
        <b>{hint}</b>
        {km != null && <div className="small">{formatDistance(km)} · {walkMinutes(km)} min walk to {target.name}</div>}
      </div>
    </div>
  );
}

// Full-screen camera with an arrow that points to an evacuation center
export default function LiveView({ isOpen, centers, firstId, onClose }: {
  isOpen: boolean; centers: EvacCenter[]; firstId: number | null; onClose: () => void;
}) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      {centers.length > 0 && firstId != null && <Camera centers={centers} firstId={firstId} onClose={onClose} />}
    </IonModal>
  );
}
