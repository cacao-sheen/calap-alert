import {
  IonButton, IonContent, IonIcon, IonLabel, IonPage, IonSegment, IonSegmentButton,
} from '@ionic/react';
import { cameraOutline, navigate } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import LiveView from '../components/LiveView';
import { usePageLoad } from '../hooks';
import type { EvacCenter, Incident } from '../types';
import {
  allowCompass, centerStatus, DEFAULT_LOCATION, directionsUrl, distanceKm, formatDistance, getLocation, incidentInfo, walkMinutes,
} from '../utils';

// Free vector map tiles with 3D buildings (no API key needed)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function pinElement(bg: string, text: string) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.style.background = bg;
  el.textContent = text;
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
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [me, setMe] = useState(DEFAULT_LOCATION);
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  const [liveOpen, setLiveOpen] = useState(false);

  usePageLoad(() => {
    api<EvacCenter[]>('/evacuation-centers').then(setCenters).catch(() => {});
    api<Incident[]>('/incidents?status=active').then(setIncidents).catch(() => {});
    getLocation().then((l) => setMe({ lat: l.lat, lng: l.lng }));
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
    for (const c of centers) {
      const st = centerStatus(c);
      markers.current.push(
        new maplibregl.Marker({ element: pinElement(st.bar, '🏫') })
          .setLngLat([c.lng, c.lat])
          .setPopup(popup(c.name, [`${c.currentOccupancy} / ${c.capacity} evacuees · ${st.label}`, `Brgy. ${c.barangay}`]))
          .addTo(m),
      );
    }
    for (const i of incidents) {
      if (i.lat == null || i.lng == null) continue;
      const info = incidentInfo(i.type);
      markers.current.push(
        new maplibregl.Marker({ element: pinElement(info.color, info.emoji) })
          .setLngLat([i.lng, i.lat])
          .setPopup(popup(info.label, [i.address ?? '', i.description, `Status: ${i.status}`]))
          .addTo(m),
      );
    }
    const dot = document.createElement('div');
    dot.className = 'pin-me';
    markers.current.push(new maplibregl.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(m));
  }, [centers, incidents, me]);

  // Focus a center when opened from the Evac list: /tabs/map?focus=<id>
  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get('focus'));
    const c = centers.find((x) => x.id === id);
    if (c && map.current) map.current.flyTo({ center: [c.lng, c.lat], zoom: 17.5 });
  }, [location.search, centers]);

  useEffect(() => {
    map.current?.easeTo({ pitch: mode === '3d' ? 55 : 0, bearing: mode === '3d' ? -20 : 0, duration: 800 });
  }, [mode]);

  const nearest = centers
    .filter((c) => c.isOpen && c.currentOccupancy < c.capacity)
    .map((c) => ({ c, km: distanceKm(me, c) }))
    .sort((a, b) => a.km - b.km)[0];

  return (
    <IonPage>
      <IonContent scrollY={false}>
        <div ref={container} className="map-container" />
        <div className="map-top">
          <IonSegment value={mode} onIonChange={(e) => setMode(e.detail.value as '2d' | '3d')}>
            <IonSegmentButton value="2d"><IonLabel>2D</IonLabel></IonSegmentButton>
            <IonSegmentButton value="3d"><IonLabel>3D</IonLabel></IonSegmentButton>
          </IonSegment>
          <div className="map-legend">
            <span>🏫 Evacuation center</span>
            <span>🌊🔥🚗 Incidents</span>
            <span style={{ color: '#1d4ed8' }}>● You</span>
          </div>
        </div>
        {nearest && (
          <div className="map-sheet">
            <div className="handle" />
            <div className="row">
              <span className="chip-icon" style={{ background: '#dcfce7', borderRadius: 12 }}>🏫</span>
              <div className="grow">
                <div className="small" style={{ color: '#16a34a', fontWeight: 700, letterSpacing: '0.04em' }}>NEAREST EVACUATION CENTER</div>
                <b>{nearest.c.name}</b>
                <div className="small muted">{formatDistance(nearest.km)} · {walkMinutes(nearest.km)} min walk · Brgy. {nearest.c.barangay}</div>
              </div>
            </div>
            <div className="between small">
              <span className="muted">Capacity</span>
              <b>{nearest.c.currentOccupancy} / {nearest.c.capacity} evacuees</b>
            </div>
            <div className="bar"><div style={{ width: `${Math.min(100, (nearest.c.currentOccupancy / nearest.c.capacity) * 100)}%`, background: centerStatus(nearest.c).bar }} /></div>
            <IonButton expand="block" onClick={() => allowCompass().then(() => setLiveOpen(true))}>
              <IonIcon slot="start" icon={cameraOutline} />Live View (camera)
            </IonButton>
            <IonButton expand="block" fill="outline" href={directionsUrl(nearest.c.lat, nearest.c.lng)} target="_blank">
              <IonIcon slot="start" icon={navigate} />Get Directions
            </IonButton>
          </div>
        )}
      </IonContent>
      <LiveView isOpen={liveOpen} centers={centers.filter((c) => c.isOpen)} firstId={nearest?.c.id ?? null} onClose={() => setLiveOpen(false)} />
    </IonPage>
  );
}
