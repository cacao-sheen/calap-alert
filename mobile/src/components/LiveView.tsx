import { IonButton, IonIcon, IonModal, IonSelect, IonSelectOption, useIonAlert } from '@ionic/react';
import { checkmark, close } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { EvacCenter } from '../types';
import { bearingDeg, distanceKm, formatDistance, walkMinutes } from '../utils';

const FIELD_OF_VIEW = 70; // rough horizontal view of a phone camera, in degrees
const ARRIVED_KM = 0.03;

type Point = { lat: number; lng: number };

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTE_MAX_KM = 0.25; // straight-line fallback: keep the dotted line inside the little map

// The point `km` away from `from`, in the direction of `to`
function towards(from: Point, to: Point, km: number): Point {
  const b = (bearingDeg(from, to) * Math.PI) / 180;
  return {
    lat: from.lat + (Math.cos(b) * km) / 111.32,
    lng: from.lng + (Math.sin(b) * km) / (111.32 * Math.cos((from.lat * Math.PI) / 180)),
  };
}

// ---- Following the walking route (from /api/directions) ----
const OFF_ROUTE_M = 40; // farther than this from the route = get a new route from here
const LOOK_AHEAD_M = 20; // the arrow points at the road this far ahead, so it turns at corners

// Metres east (x) / north (y) of `o`; flat-earth is fine for a few km
function toXY(o: Point, p: Point) {
  return { x: (p.lng - o.lng) * 111320 * Math.cos((o.lat * Math.PI) / 180), y: (p.lat - o.lat) * 110540 };
}

// The closest spot on the route to me: segment index, the spot, and how far I am from it (m)
function locate(route: Point[], me: Point) {
  let best = { i: 0, at: route[0], offM: Infinity };
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = toXY(a, route[i + 1]);
    const m = toXY(a, me);
    const len2 = b.x * b.x + b.y * b.y;
    const t = len2 ? Math.max(0, Math.min(1, (m.x * b.x + m.y * b.y) / len2)) : 0;
    const at = { lat: a.lat + (route[i + 1].lat - a.lat) * t, lng: a.lng + (route[i + 1].lng - a.lng) * t };
    const offM = distanceKm(me, at) * 1000;
    if (offM < best.offM) best = { i, at, offM };
  }
  return best;
}

// The part of the route still ahead of me
function remaining(route: Point[], me: Point): Point[] {
  const { i, at } = locate(route, me);
  return [at, ...route.slice(i + 1)];
}

const lengthKm = (line: Point[]) => line.slice(1).reduce((sum, p, i) => sum + distanceKm(line[i], p), 0);

// The point `m` metres along the line (or its end)
function pointAlong(line: Point[], m: number): Point {
  for (let i = 0; i < line.length - 1; i++) {
    const seg = distanceKm(line[i], line[i + 1]) * 1000;
    if (m <= seg && seg > 0) {
      const t = m / seg;
      return { lat: line[i].lat + (line[i + 1].lat - line[i].lat) * t, lng: line[i].lng + (line[i + 1].lng - line[i].lng) * t };
    }
    m -= seg;
  }
  return line[line.length - 1];
}

// Round mini-map at the bottom: it turns with the phone and shows the dotted walking route
function MiniMap({ me, target, route, heading }: { me: Point | null; target: Point; route: Point[] | null; heading: number | null }) {
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
  const applied = useRef<{ me: Point; heading: number; route: Point[] | null } | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !me) return;
    const bearing = heading ?? 0;
    const prev = applied.current;
    if (prev && prev.route === route && distanceKm(prev.me, me) < 0.002 && Math.abs(((bearing - prev.heading + 540) % 360) - 180) < 3) return;
    const line = route
      ? [me, ...remaining(route, me)]
      : [me, distanceKm(me, target) > ROUTE_MAX_KM ? towards(me, target, ROUTE_MAX_KM) : target];
    const update = () => {
      applied.current = { me, heading: bearing, route };
      (m.getSource('route') as maplibregl.GeoJSONSource | undefined)?.setData({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: line.map((p) => [p.lng, p.lat]) },
      });
      m.jumpTo({ center: [me.lng, me.lat], bearing });
    };
    if (ready.current) update();
    else m.once('live-ready', update);
  }, [me, target, route, heading, hasMe]);

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

  // Walking route along real roads. Asked again for a new center, when I'm off the route, or when
  // the last try failed (at most every 20 s, so a shaky GPS doesn't flood the server).
  const [route, setRoute] = useState<Point[] | null>(null);
  const routeFor = useRef<{ id: number; at: number } | null>(null);
  useEffect(() => {
    if (!me) return;
    const asked = routeFor.current;
    const newTarget = asked?.id !== target.id;
    const waited = asked != null && Date.now() - asked.at > 20_000;
    const offRoute = route != null && locate(route, me).offM > OFF_ROUTE_M;
    if (!newTarget && !(waited && (offRoute || route == null))) return;
    routeFor.current = { id: target.id, at: Date.now() };
    if (newTarget) setRoute(null);
    api<{ coordinates: [number, number][] }>(`/directions?from=${me.lat},${me.lng}&to=${target.lat},${target.lng}`)
      .then((r) => {
        if (routeFor.current?.id === target.id) setRoute(r.coordinates.map(([lng, lat]) => ({ lat, lng })));
      })
      .catch(() => {}); // keep the straight-line arrow
  }, [me, target.id]);

  const ahead = me && route ? remaining(route, me) : null;
  // Aim at the road a little ahead (so the arrow turns at corners); without a route, straight at the center
  const aim = ahead ? pointAlong(ahead, LOOK_AHEAD_M) : target;
  const km = me ? (ahead ? lengthKm(ahead) : distanceKm(me, target)) : null;
  // -180..180: negative = turn left, positive = turn right
  const turn = me && heading != null ? ((bearingDeg(me, aim) - heading + 540) % 360) - 180 : null;
  // No compass: still show the arrow, pointing on a north-up basis, so it never disappears
  const arrowAngle = turn ?? (me ? bearingDeg(me, aim) : 0);
  const inView = turn != null && Math.abs(turn) < FIELD_OF_VIEW / 2;
  const arrived = me != null && (distanceKm(me, target) < ARRIVED_KM || (km != null && km < ARRIVED_KM));

  // Once you reach a center it stays "reached", even if the GPS jumps a few metres away afterwards
  const [reachedId, setReachedId] = useState<number | null>(null);
  useEffect(() => {
    if (arrived && reachedId !== target.id) setReachedId(target.id);
  }, [arrived, target.id]);
  const reached = reachedId === target.id;

  const [ask] = useIonAlert();
  // Both the ✕ and "End Live View" ask first, so a mis-tap never stops the guidance
  const confirmEnd = () =>
    ask({
      header: 'End Live View?',
      message: reached ? `You reached ${target.name}.` : `You haven't reached ${target.name} yet.`,
      buttons: [{ text: 'Not yet', role: 'cancel' }, { text: 'End', handler: onClose }],
    });

  let hint = '';
  if (camError) hint = camError;
  else if (!me) hint = 'Finding your location…';
  else if (heading == null) hint = 'No compass signal. Arrow shows direction with north up.';
  else if (arrived) hint = "You're here!";
  else if (inView) hint = route ? 'Follow the road' : 'Keep going straight';
  else hint = turn! > 0 ? 'Turn right' : 'Turn left';

  return (
    <div className="live-view">
      <video ref={video} autoPlay playsInline muted />
      <div className="live-top">
        <IonSelect value={targetId} interface="popover" onIonChange={(e) => setTargetId(e.detail.value)} aria-label="Evacuation center">
          {centers.map((c) => <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>)}
        </IonSelect>
        <IonButton fill="clear" color="light" onClick={confirmEnd} aria-label="Close"><IonIcon slot="icon-only" icon={close} /></IonButton>
      </div>

      {!reached && (
        <div className="live-guide" style={{ opacity: me ? 1 : 0.5 }}>
          <div className="live-label">
            {hint}
            {km != null && <small>{formatDistance(km)} · {walkMinutes(km)} min walk to {target.name}{route ? '' : ' (straight line)'}</small>}
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

      {reached && (
        <div className="live-arrived">
          <div className="live-arrived-card">
            <span className="live-arrived-check"><IonIcon icon={checkmark} /></span>
            <h2>You've arrived!</h2>
            <p>You reached <b>{target.name}</b>.</p>
            <p className="small">Go inside and tell the staff your name. In the app, tap "I'm at an evacuation center" so your barangay knows you're safe.</p>
            <IonButton expand="block" onClick={confirmEnd}>End Live View</IonButton>
          </div>
        </div>
      )}

      {!reached && turn != null && !inView && (
        <div className="live-dot" style={{ [turn > 0 ? 'right' : 'left']: 14 }} />
      )}

      <MiniMap me={me} target={target} route={route} heading={heading} />
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
