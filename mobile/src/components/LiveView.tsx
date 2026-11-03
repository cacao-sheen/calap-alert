import { IonButton, IonIcon, IonModal, IonSelect, IonSelectOption } from '@ionic/react';
import { close } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { EvacCenter } from '../types';
import { bearingDeg, distanceKm, formatDistance, walkMinutes } from '../utils';

const FIELD_OF_VIEW = 70; // rough horizontal view of a phone camera, in degrees
const ARRIVED_KM = 0.03;

type Point = { lat: number; lng: number };

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTE_MAX_KM = 0.25; // keep the dotted line inside the little map even when the center is far away

// The point `km` away from `from`, in the direction of `to`
function towards(from: Point, to: Point, km: number): Point {
  const b = (bearingDeg(from, to) * Math.PI) / 180;
  return {
    lat: from.lat + (Math.cos(b) * km) / 111.32,
    lng: from.lng + (Math.sin(b) * km) / (111.32 * Math.cos((from.lat * Math.PI) / 180)),
  };
}

// Round mini-map at the bottom: it turns with the phone and shows a dotted route to the center
function MiniMap({ me, target, heading }: { me: Point | null; target: Point; heading: number | null }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const [mapStreet, setMapStreet] = useState('');
  const [apiStreet, setApiStreet] = useState('');
  const street = mapStreet || apiStreet;

  // Start the map only once we know where you are, so it loads the tiles around you (not 28 km away)
  const hasMe = me != null;
  const lastMe = useRef<Point | null>(me);
  if (me) lastMe.current = me; // set during render so the effect below always sees it
  useEffect(() => {
    if (!box.current || !hasMe) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: MAP_STYLE,
      center: [lastMe.current!.lng, lastMe.current!.lat],
      zoom: 17,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    m.on('load', () => {
      m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'route', type: 'line', source: 'route',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#1a73e8', 'line-width': 6, 'line-dasharray': [0.1, 1.6] },
      });
      ready.current = true;
      m.fire('live-ready');
    });
    // Street name = a road label under the middle of the map (read from the map tiles, no extra service)
    m.on('idle', () => {
      const c = m.project(m.getCenter());
      const hit = m.queryRenderedFeatures([[c.x - 40, c.y - 40], [c.x + 40, c.y + 40]])
        .find((f) => f.sourceLayer === 'transportation_name' && f.properties?.name);
      setMapStreet(hit ? String(hit.properties['name:latin'] ?? hit.properties.name) : '');
    });
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(box.current);
    map.current = m;
    return () => { observer.disconnect(); ready.current = false; m.remove(); map.current = null; };
  }, [hasMe]);

  // The compass reports many times a second; only move the map for a real change (3 degrees or ~2 m)
  const applied = useRef<{ me: Point; heading: number } | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !me) return;
    const bearing = heading ?? 0;
    const prev = applied.current;
    if (prev && distanceKm(prev.me, me) < 0.002 && Math.abs(((bearing - prev.heading + 540) % 360) - 180) < 3) return;
    const end = distanceKm(me, target) > ROUTE_MAX_KM ? towards(me, target, ROUTE_MAX_KM) : target;
    const update = () => {
      applied.current = { me, heading: bearing };
      (m.getSource('route') as maplibregl.GeoJSONSource | undefined)?.setData({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: [[me.lng, me.lat], [end.lng, end.lat]] },
      });
      m.jumpTo({ center: [me.lng, me.lat], bearing });
    };
    if (ready.current) update();
    else m.once('live-ready', update);
  }, [me, target, heading, hasMe]);

  // Fallback when the map tiles have no road label: ask the backend (only when you have moved ~15 m)
  const asked = useRef<Point | null>(null);
  useEffect(() => {
    if (!me || (asked.current && distanceKm(asked.current, me) < 0.015)) return;
    asked.current = me;
    api<{ street: string | null }>(`/street?lat=${me.lat}&lng=${me.lng}`)
      .then((r) => setApiStreet(r.street ?? ''))
      .catch(() => {});
  }, [me]);

  return (
    <div className="live-minimap">
      <div ref={box} className="live-minimap-map" />
      {street && <div className="live-street">{street}</div>}
      <div className="live-minimap-me"><svg viewBox="0 0 24 24"><path d="M12 2 20 21 12 17 4 21z" fill="#1a73e8" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" /></svg></div>
    </div>
  );
}

// Compass direction the BACK camera faces. Works with the phone held upright or flat.
function cameraHeading(e: DeviceOrientationEvent): number | null {
  const ios = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
  if (typeof ios === 'number') return ios;

  // Android: only "absolute" readings are tied to north (relative ones would point the wrong way)
  if (!e.absolute || e.alpha == null || e.beta == null || e.gamma == null) return null;
  const rad = Math.PI / 180;
  const [a, b, g] = [e.alpha * rad, e.beta * rad, e.gamma * rad];
  const x = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const y = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  const heading = (Math.atan2(x, y) / rad + 360) % 360;
  return Number.isFinite(heading) ? heading : null;
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
  // No compass: still show the arrow, pointing on a north-up basis, so it never disappears
  const arrowAngle = turn ?? (me ? bearingDeg(me, target) : 0);
  const inView = turn != null && Math.abs(turn) < FIELD_OF_VIEW / 2;
  const arrived = km != null && km < ARRIVED_KM;

  let hint = '';
  if (camError) hint = camError;
  else if (!me) hint = 'Finding your location…';
  else if (heading == null) hint = 'No compass signal. Arrow shows direction with north up.';
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

      {(
        <div className="live-guide" style={{ opacity: me ? 1 : 0.5 }}>
          <div className="live-label">
            {hint}
            {km != null && <small>{formatDistance(km)} · {walkMinutes(km)} min walk to {target.name}</small>}
          </div>
          {!arrived && <div className="live-chevrons" style={{ transform: `rotate(${inView ? 0 : arrowAngle}deg)` }}>
            <div className="live-chevrons-tilt">
              {[0, 1, 2].map((i) => (
                <svg key={i} viewBox="0 0 100 80" style={{ animationDelay: `${(2 - i) * 0.2}s` }}>
                  {/* stacked darker copies give the arrow a thick 3D side */}
                  {[16, 13, 10, 7, 4].map((d) => (
                    <polygon key={d} transform={`translate(0 ${d})`} points="0,40 50,0 100,40 100,60 50,20 0,60" fill={d > 8 ? '#123f96' : '#1a56c4'} />
                  ))}
                  <polygon points="0,40 50,0 100,40 100,60 50,20 0,60" fill="#f4f6fa" stroke="#1a73e8" strokeWidth="4" strokeLinejoin="round" />
                </svg>
              ))}
            </div>
          </div>}
        </div>
      )}

      {!arrived && turn != null && !inView && (
        <div className="live-dot" style={{ [turn > 0 ? 'right' : 'left']: 14 }} />
      )}

      <MiniMap me={me} target={target} heading={heading} />
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
