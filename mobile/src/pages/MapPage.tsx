import {
  IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton, useIonRouter,
} from '@ionic/react';
import { businessOutline, cameraOutline, carOutline, close, navigate, walkOutline } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import NotifBell from '../components/NotifBell';
import LiveView from '../components/LiveView';
import { usePageLoad } from '../hooks';
import type { EvacCenter, Incident } from '../types';
import {
  allowCompass, centerStatus, DEFAULT_LOCATION, directionsUrl, distanceKm, formatDistance, getLocation, incidentInfo, walkMinutes,
} from '../utils';

// Free vector map tiles with 3D buildings (no API key needed)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Walking route from the backend (/api/directions). straight = the route server failed, so it's a straight line.
type Route = { coordinates: [number, number][]; distanceM: number; durationS?: number; straight?: boolean };

// Short trips: walking time. Longer trips: time by vehicle along the main roads.
const WALK_MAX_KM = 3;

function pinElement(bg: string, icon: string) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.style.background = bg;
  const i = document.createElement('ion-icon') as HTMLElement & { icon: string };
  i.icon = icon;
  el.appendChild(i);
  return el;
}

function popup(title: string, lines: string[]) {
  const div = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = title;
  div.appendChild(b);
  for (const line of lines) {
    const p = document.createElement('div');
    p.textContent = line;
    p.style.fontSize = '12px';
    div.appendChild(p);
  }
  return new maplibregl.Popup({ offset: 22 }).setDOMContent(div);
}

export default function MapPage() {
  const location = useLocation();
  const router = useIonRouter();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [me, setMe] = useState(DEFAULT_LOCATION);
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  const [liveOpen, setLiveOpen] = useState(false);
  const [target, setTarget] = useState<EvacCenter | null>(null); // center picked with "Show on map"
  const [route, setRoute] = useState<Route | null>(null);

  // Opening the Map centers it on me when GPS works. Not when a center was picked: its route sets the view.
  const search = useRef(location.search);
  search.current = location.search;
  usePageLoad(() => {
    api<EvacCenter[]>('/evacuation-centers').then(setCenters).catch(() => {});
    api<Incident[]>('/incidents?status=active').then(setIncidents).catch(() => {});
    getLocation().then((l) => {
      setMe({ lat: l.lat, lng: l.lng });
      if (l.fromGps && !new URLSearchParams(search.current).get('focus')) {
        map.current?.flyTo({ center: [l.lng, l.lat], zoom: 16.5, duration: 1200 });
      }
    });
  });

  // Create the map once
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: [DEFAULT_LOCATION.lng, DEFAULT_LOCATION.lat],
      zoom: 16,
      pitch: 55,
      bearing: -20,
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    m.on('load', () => {
      // Add 3D buildings if the style does not already have them
      const hasExtrusion = m.getStyle().layers?.some((l) => l.type === 'fill-extrusion');
      if (!hasExtrusion && m.getSource('openmaptiles')) {
        m.addLayer({
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#d6dbe3',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.85,
          },
        });
      }
    });
    map.current = m;
    // Ionic creates the page before it is visible, so resize the map whenever its box changes size
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Draw markers whenever data changes
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    // Tapping a center opens its card at the bottom with the walking route (same as "Show on map" in Evac)
    for (const c of centers) {
      const st = centerStatus(c);
      const element = pinElement(st.bar, businessOutline);
      element.style.cursor = 'pointer';
      element.addEventListener('click', () => router.push(`/tabs/map?focus=${c.id}`, 'none', 'replace'));
      markers.current.push(new maplibregl.Marker({ element }).setLngLat([c.lng, c.lat]).addTo(m));
    }
    for (const i of incidents) {
      if (i.lat == null || i.lng == null) continue;
      const info = incidentInfo(i.type);
      markers.current.push(
        new maplibregl.Marker({ element: pinElement(info.color, info.icon) })
          .setLngLat([i.lng, i.lat])
          .setPopup(popup(info.label, [i.address ?? '', i.description, `Status: ${i.status}`]))
          .addTo(m),
      );
    }
    const dot = document.createElement('div');
    dot.className = 'pin-me';
    markers.current.push(new maplibregl.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(m));
  }, [centers, incidents, me]);

  // "Show on map" from the Evac list (/tabs/map?focus=<id>): find where I am right now,
  // then get the walking route to that center.
  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get('focus'));
    const c = centers.find((x) => x.id === id) ?? null;
    setTarget(c);
    setRoute(null);
    if (!c) return;
    let cancelled = false;
    (async () => {
      const here = await getLocation();
      if (cancelled) return;
      setMe({ lat: here.lat, lng: here.lng });
      let r: Route;
      try {
        r = await api<Route>(`/directions?from=${here.lat},${here.lng}&to=${c.lat},${c.lng}`);
      } catch {
        r = { coordinates: [[here.lng, here.lat], [c.lng, c.lat]], distanceM: distanceKm(here, c) * 1000, straight: true };
      }
      if (!cancelled) setRoute(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [location.key, centers.length]);

  // Draw the route line and zoom so both me and the center fit above the bottom sheet
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      const data: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: route?.coordinates ?? [] },
      };
      const source = m.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        m.addSource('route', { type: 'geojson', data });
        const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
        m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout, paint: { 'line-color': '#ffffff', 'line-width': 10 } });
        m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout, paint: { 'line-color': '#2563eb', 'line-width': 6 } });
      }
      if (route) {
        const bounds = new maplibregl.LngLatBounds();
        route.coordinates.forEach((c) => bounds.extend(c));
        m.fitBounds(bounds, { padding: { top: 140, bottom: 320, left: 50, right: 50 }, maxZoom: 17.5, duration: 1200 });
      }
    };
    if (m.isStyleLoaded()) draw();
    else m.once('idle', draw);
  }, [route]);

  // Opened by tapping an evacuation notification (/tabs/map?live=1): go straight to Live View.
  // location.key changes on every tap, so a second notification opens it again.
  const liveOpenedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('live') !== '1' || !centers.length) return;
    if (liveOpenedFor.current === location.key) return;
    liveOpenedFor.current = location.key;
    allowCompass().then(() => setLiveOpen(true));
  }, [location.key, location.search, centers.length]);

  useEffect(() => {
    map.current?.easeTo({ pitch: mode === '3d' ? 55 : 0, bearing: mode === '3d' ? -20 : 0, duration: 800 });
  }, [mode]);

  const nearest = centers
    .filter((c) => c.isOpen && c.currentOccupancy < c.capacity)
    .map((c) => ({ c, km: distanceKm(me, c) }))
    .sort((a, b) => a.km - b.km)[0];
  // The card only shows after a center is tapped (or picked in Evac); distance is along the route once loaded
  const shown = target ? { c: target, km: route ? route.distanceM / 1000 : distanceKm(me, target) } : null;

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div ref={container} className="map-container" />
        <div className="map-bell"><NotifBell light /></div>
        <div className="map-top">
          <IonSegment value={mode} onIonChange={(e) => setMode(e.detail.value as '2d' | '3d')}>
            <IonSegmentButton value="2d"><IonLabel>2D</IonLabel></IonSegmentButton>
            <IonSegmentButton value="3d"><IonLabel>3D</IonLabel></IonSegmentButton>
          </IonSegment>
          <div className="map-legend">
            <span><i style={{ background: '#16a34a' }} />Evacuation center</span>
            <span><i style={{ background: '#b91c1c' }} />Incident</span>
            <span><i style={{ background: '#2563eb' }} />You</span>
          </div>
        </div>
        {shown && (
          <div className="map-sheet">
            <div className="handle" />
            <div className="row">
              <span className="chip-icon solid-icon" style={{ background: '#16a34a' }}><IonIcon icon={businessOutline} /></span>
              <div className="grow">
                <div className="kicker">
                  {route ? (route.straight ? 'Straight-line distance' : 'Route via main roads') : 'Finding your route…'}
                </div>
                <b>{shown.c.name}</b>
                <div className="small muted">
                  {formatDistance(shown.km)} · {shown.km > WALK_MAX_KM && route?.durationS
                    ? <><IonIcon icon={carOutline} style={{ verticalAlign: -2 }} /> {Math.max(1, Math.round(route.durationS / 60))} min by vehicle</>
                    : <><IonIcon icon={walkOutline} style={{ verticalAlign: -2 }} /> {walkMinutes(shown.km)} min walk</>}
                  {' '}· Brgy. {shown.c.barangay}
                </div>
              </div>
              {target && (
                <IonButton fill="clear" color="medium" size="small" aria-label="Clear route" onClick={() => router.push('/tabs/map', 'none', 'replace')}>
                  <IonIcon slot="icon-only" icon={close} />
                </IonButton>
              )}
            </div>
            <div className="between small">
              <span className="muted">Capacity</span>
              <b>{shown.c.currentOccupancy} / {shown.c.capacity} evacuees</b>
            </div>
            <div className="bar"><div style={{ width: `${Math.min(100, (shown.c.currentOccupancy / shown.c.capacity) * 100)}%`, background: centerStatus(shown.c).bar }} /></div>
            <div className="two-buttons">
              <IonButton onClick={() => allowCompass().then(() => setLiveOpen(true))}>
                <IonIcon slot="start" icon={cameraOutline} />Live View
              </IonButton>
              <IonButton fill="outline" href={directionsUrl(shown.c.lat, shown.c.lng)} target="_blank">
                <IonIcon slot="start" icon={navigate} />Directions
              </IonButton>
            </div>
          </div>
        )}
      </IonContent>
      <LiveView isOpen={liveOpen} centers={centers.filter((c) => c.isOpen || c.id === target?.id)} firstId={target?.id ?? nearest?.c.id ?? null} onClose={() => setLiveOpen(false)} />
    </IonPage>
  );
}
