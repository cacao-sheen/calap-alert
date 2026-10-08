import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import type { EvacCenter, Incident } from '../types';
import { centerState, INCIDENT_INFO } from '../utils';

// Free vector map tiles with 3D buildings (no API key needed)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const IBABA = { lat: 13.4135, lng: 121.18 };

function pin(bg: string, text: string, size = 30) {
  const el = document.createElement('div');
  el.className = 'pin';
  Object.assign(el.style, { background: bg, width: `${size}px`, height: `${size}px` });
  el.textContent = text;
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
  height?: number;
  focus?: { lat: number; lng: number } | null;
  zoom?: number;
  onIncidentClick?: (id: number) => void;
};

export default function MapView({ centers = [], incidents = [], height = 320, focus, zoom = 15.5, onIncidentClick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [mode, setMode] = useState<'2d' | '3d'>('3d');

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: MAP_STYLE,
      center: [focus?.lng ?? IBABA.lng, focus?.lat ?? IBABA.lat],
      zoom,
      pitch: 50,
      bearing: -20,
    });
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
      markers.current.push(new maplibregl.Marker({ element: pin(st.bar, '🏫') })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup(c.name, [`${c.currentOccupancy} / ${c.capacity} evacuees · ${st.label}`, `Brgy. ${c.barangay}`]))
        .addTo(m));
    }
    for (const i of incidents) {
      if (i.lat == null || i.lng == null) continue;
      const info = INCIDENT_INFO[i.type];
      const element = pin(info.color, info.emoji);
      if (onIncidentClick) element.addEventListener('click', () => onIncidentClick(i.id));
      markers.current.push(new maplibregl.Marker({ element })
        .setLngLat([i.lng, i.lat])
        .setPopup(popup(`${info.label} · ${i.address ?? ''}`, [i.description, `Status: ${i.status}`]))
        .addTo(m));
    }
  }, [centers, incidents, onIncidentClick]);

  useEffect(() => {
    if (focus && map.current) map.current.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(zoom, 16.5) });
  }, [focus?.lat, focus?.lng]);

  useEffect(() => {
    map.current?.easeTo({ pitch: mode === '3d' ? 50 : 0, bearing: mode === '3d' ? -20 : 0, duration: 700 });
  }, [mode]);

  return (
    <div className="map-wrap" style={{ height }}>
      <div ref={el} className="map" />
      <IonSegment className="map-toggle" value={mode} onIonChange={(e) => setMode(e.detail.value as '2d' | '3d')}>
        <IonSegmentButton value="2d"><IonLabel>2D</IonLabel></IonSegmentButton>
        <IonSegmentButton value="3d"><IonLabel>3D</IonLabel></IonSegmentButton>
      </IonSegment>
    </div>
  );
}
