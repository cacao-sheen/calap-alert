import { IonButton, IonIcon, IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import type { EvacCenter, Incident, SharedLocation } from '../types';
import { businessOutline, peopleOutline, person } from 'ionicons/icons';
import { centerState, INCIDENT_INFO, SAFETY, timeAgo } from '../utils';

// Free vector map tiles with 3D buildings (no API key needed)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const CALAPAN = { lat: 13.4135, lng: 121.18 }; // city proper, where the map opens

export function pin(bg: string, icon: string, size = 30) {
  const el = document.createElement('div');
  el.className = 'pin';
  Object.assign(el.style, { background: bg, width: `${size}px`, height: `${size}px` });
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
  for (const line of lines.filter(Boolean)) {
    const p = document.createElement('div');
    p.textContent = line;
    div.appendChild(p);
  }
  return new maplibregl.Popup({ offset: 18 }).setDOMContent(div);
}

type Props = {
  centers?: EvacCenter[];
  incidents?: Incident[];
  people?: SharedLocation[]; // residents sharing their location
  checkInRunning?: boolean; // true = colour residents by safety status; false = all green
  height?: number;
  focus?: { lat: number; lng: number } | null;
  zoom?: number;
  onIncidentClick?: (id: number) => void;
};

export default function MapView({ centers = [], incidents = [], people = [], checkInRunning = false, height = 320, focus, zoom = 15.5, onIncidentClick }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [mode, setMode] = useState<'2d' | '3d'>('3d');

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: MAP_STYLE,
      center: [focus?.lng ?? CALAPAN.lng, focus?.lat ?? CALAPAN.lat],
      zoom,
      pitch: 50,
      bearing: -20,
    });
    // Full-screen button. The whole box goes full screen (not just the map) so the 2D/3D switch comes along.
    m.addControl(new maplibregl.FullscreenControl({ container: wrap.current ?? undefined }), 'top-right');
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    m.on('load', () => {
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
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = [];
    for (const c of centers) {
      const st = centerState(c);
      markers.current.push(new maplibregl.Marker({ element: pin(st.bar, businessOutline) })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup(c.name, [`${c.currentOccupancy} / ${c.capacity} evacuees · ${st.label}`, `Brgy. ${c.barangay}`]))
        .addTo(m));
    }
    // Without a disaster check-in nobody has a status yet ("unaccounted" would show everyone in red), so all green
    for (const p of people) {
      const element = pin(checkInRunning ? SAFETY[p.status].hex : SAFETY.safe.hex, person, 28);
      element.classList.add('person-pin');
      element.title = `${p.firstName} ${p.lastName}`;
      markers.current.push(new maplibregl.Marker({ element })
        .setLngLat([p.lng, p.lat])
        .setPopup(popup(`${p.firstName} ${p.lastName}`, [
          `${checkInRunning ? SAFETY[p.status].label : 'Sharing location'} · Brgy. ${p.barangay}`,
          p.contactNumber ?? 'No phone number',
          `Location updated ${timeAgo(p.updatedAt)}`,
        ]))
        .addTo(m));
    }
    for (const i of incidents) {
      if (i.lat == null || i.lng == null) continue;
      const info = INCIDENT_INFO[i.type];
      const element = pin(info.color, info.icon);
      if (onIncidentClick) element.addEventListener('click', () => onIncidentClick(i.id));
      markers.current.push(new maplibregl.Marker({ element })
        .setLngLat([i.lng, i.lat])
        .setPopup(popup(`${info.label} · ${i.address ?? ''}`, [i.description, `Status: ${i.status}`]))
        .addTo(m));
    }
  }, [centers, incidents, people, checkInRunning, onIncidentClick]);

  useEffect(() => {
    if (focus && map.current) map.current.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(zoom, 16.5) });
  }, [focus?.lat, focus?.lng]);

  useEffect(() => {
    map.current?.easeTo({ pitch: mode === '3d' ? 50 : 0, bearing: mode === '3d' ? -20 : 0, duration: 700 });
  }, [mode]);

  // Residents can be far from Calapan proper (where the map opens), so jump to them on request
  function showPeople() {
    const m = map.current;
    if (!m || !people.length) return;
    if (people.length === 1) {
      m.flyTo({ center: [people[0].lng, people[0].lat], zoom: 16.5 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    people.forEach((p) => bounds.extend([p.lng, p.lat]));
    m.fitBounds(bounds, { padding: 80, maxZoom: 16.5 });
  }

  // At least `height` px; taller when the window has room (e.g. zoomed out)
  return (
    <div ref={wrap} className="map-wrap" style={{ height:`max(${height}px, ${(height / 9).toFixed(1)}vh)` }}>
      <div ref={el} className="map" />
      <IonSegment className="map-toggle" value={mode} onIonChange={(e) => setMode(e.detail.value as '2d' | '3d')}>
        <IonSegmentButton value="2d"><IonLabel>2D</IonLabel></IonSegmentButton>
        <IonSegmentButton value="3d"><IonLabel>3D</IonLabel></IonSegmentButton>
      </IonSegment>
      {people.length > 0 && (
        <IonButton className="map-people" size="small" onClick={showPeople}>
          <IonIcon slot="start" icon={peopleOutline} />
          Show {people.length} sharing location
        </IonButton>
      )}
    </div>
  );
}
