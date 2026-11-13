import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonSegment, IonSegmentButton } from '@ionic/react';
import { businessOutline, locate } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { EvacCenter } from '../types';
import { pin } from './MapView';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
// Free satellite photos (Esri World Imagery, no API key) so the admin can see the real buildings and shops
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const CALAPAN = { lat: 13.4135, lng: 121.18 }; // city proper, where the map opens

type Result = { title: string; detail: string; kind: string; address: string; barangay: string | null; lat: number; lng: number };
export type Details = { name?: string; address?: string; barangay?: string };

type Props = {
  lat: string;
  lng: string;
  centers: EvacCenter[];
  onChange: (lat: number, lng: number) => void;
  onDetails: (details: Details) => void;
};

// Map where the admin clicks (or drags the red pin) to choose the spot of a new evacuation center.
export default function LocationPicker({ lat, lng, centers, onChange, onDetails }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [note, setNote] = useState('');
  const [view, setView] = useState<'satellite' | 'map'>('satellite');
  const viewNow = useRef(view);
  viewNow.current = view;

  // Keep the latest callbacks for the map listeners, which are created only once
  const lookup = useRef(0); // only the newest click's answer is used
  const handlers = useRef({ onChange, onDetails });
  handlers.current = { onChange, onDetails };

  // Pin a spot, then fill in the name / address / barangay we can work out from it.
  // `known` comes from a picked search suggestion (name + address); its barangay is still looked up if missing.
  function choose(la: number, ln: number, known?: Details) {
    const { onChange, onDetails } = handlers.current;
    onChange(Number(la.toFixed(6)), Number(ln.toFixed(6)));
    const mine = ++lookup.current;
    onDetails(known ?? { barangay: '' }); // clear the old pin's barangay while we look
    if (known?.barangay) return;
    api<{ street: string | null; place: string | null; barangay: string | null; address: string | null }>(`/street?lat=${la}&lng=${ln}&places=1`)
      .then((r) => mine === lookup.current && handlers.current.onDetails(known
        ? { barangay: r.barangay ?? '' }
        : {
            name: r.place ?? '', // empty clears the previous pin's auto-filled name
            address: r.address ?? '',
            barangay: r.barangay ?? '', // empty = OpenStreetMap doesn't know; the admin picks it
          }))
      .catch(() => {});
  }

  useEffect(() => {
    if (!el.current) return;
    const start = Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng))
      ? { lat: parseFloat(lat), lng: parseFloat(lng) }
      : CALAPAN;
    const m = new maplibregl.Map({ container: el.current, style: MAP_STYLE, center: [start.lng, start.lat], zoom: 15.5 });
    m.addControl(new maplibregl.FullscreenControl({ container: wrap.current ?? undefined }), 'top-right');
    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    m.on('click', (e) => choose(e.lngLat.lat, e.lngLat.lng));
    // Satellite photo goes under the first label layer, so street and place names still show on top of it
    m.on('load', () => {
      const firstLabel = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
      m.addSource('satellite', {
        type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      });
      m.addLayer({
        id: 'satellite', type: 'raster', source: 'satellite',
        layout: { visibility: viewNow.current === 'satellite' ? 'visible' : 'none' },
      }, firstLabel);
    });

    // Existing centers (grey) so the admin can see what is already pinned nearby
    for (const c of centers) {
      const dot = pin('#64748b', businessOutline, 26);
      dot.style.cursor = 'default';
      dot.title = c.name;
      new maplibregl.Marker({ element: dot }).setLngLat([c.lng, c.lat]).addTo(m);
    }

    map.current = m;
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (m?.getLayer('satellite')) m.setLayoutProperty('satellite', 'visibility', view === 'satellite' ? 'visible' : 'none');
  }, [view]);

  // Move the red pin whenever the latitude/longitude change (typed, clicked, searched or dragged)
  useEffect(() => {
    const m = map.current;
    const la = parseFloat(lat);
    const ln = parseFloat(lng);
    if (!m || !Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return;
    if (!marker.current) {
      const mk = new maplibregl.Marker({ color: '#dc2626', draggable: true }).setLngLat([ln, la]).addTo(m);
      mk.on('dragend', () => {
        const p = mk.getLngLat();
        choose(p.lat, p.lng);
      });
      marker.current = mk;
    } else {
      marker.current.setLngLat([ln, la]);
    }
    if (!m.getBounds().contains([ln, la])) m.flyTo({ center: [ln, la], zoom: 16.5 });
  }, [lat, lng]);

  // Suggestions appear while typing (waits 300 ms after the last key)
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const q = text.trim();
    if (q.length < 2) {
      setResults([]);
      setNote('');
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const list = await api<Result[]>(`/street/search?q=${encodeURIComponent(q)}`);
        if (stale) return;
        setResults(list);
        setNote(list.length ? '' : 'No place found. Try another name, or click the map.');
      } catch (e) {
        if (!stale) setNote((e as Error).message);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [text]);

  function pick(r: Result) {
    picked.current = true;
    setText(r.title);
    setResults([]);
    setNote('');
    map.current?.flyTo({ center: [r.lng, r.lat], zoom: 17 });
    choose(r.lat, r.lng, { name: r.title, address: r.address, barangay: r.barangay ?? '' });
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        map.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 17 });
        choose(p.coords.latitude, p.coords.longitude);
      },
      () => setNote('Could not get your location. Click on the map instead.'),
    );
  }

  return (
    <div>
      <div className="picker-search">
        <IonSearchbar
          value={text}
          placeholder="Search a place (school, gym, hall…)"
          debounce={0}
          onIonInput={(e) => setText(e.detail.value ?? '')}
          onKeyDown={(e) => e.key === 'Enter' && results[0] && pick(results[0])}
        />
        <IonButton fill="outline" onClick={useMyLocation} title="Use my location"><IonIcon icon={locate} /></IonButton>
      </div>
      {note && <p className="muted small">{note}</p>}
      {results.length > 0 && (
        <IonList>
          {results.map((r) => (
            <IonItem key={`${r.lat},${r.lng}`} button onClick={() => pick(r)}>
              <IonLabel className="ion-text-wrap">
                <h3>{r.title}</h3>
                <p>{[r.kind, r.detail].filter(Boolean).join(' · ')}</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      )}
      <div ref={wrap} className="map-wrap picker-map">
        <IonSegment className="map-toggle picker-view" value={view} onIonChange={(e) => setView(e.detail.value as 'satellite' | 'map')}>
          <IonSegmentButton value="satellite"><IonLabel>Satellite</IonLabel></IonSegmentButton>
          <IonSegmentButton value="map"><IonLabel>Map</IonLabel></IonSegmentButton>
        </IonSegment>
        <div ref={el} className="map" />
      </div>
      <p className="muted small">Click the map or drag the red pin to set the exact spot. Grey pins are existing centers.</p>
    </div>
  );
}
