import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

type Props = { lat: number; lng: number; onMove: (lat: number, lng: number) => void };

// Small map with a red pin. The resident drags the pin (or taps the map) to put it on the exact spot.
export default function PinMap({ lat, lng, onMove }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pin = useRef<maplibregl.Marker | null>(null);
  const moved = useRef(onMove);
  moved.current = onMove;

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({ container: el.current, style: MAP_STYLE, center: [lng, lat], zoom: 17.5, attributionControl: false });
    const mk = new maplibregl.Marker({ color: '#dc2626', draggable: true }).setLngLat([lng, lat]).addTo(m);
    mk.on('dragend', () => {
      const p = mk.getLngLat();
      moved.current(p.lat, p.lng);
    });
    m.on('click', (e) => {
      mk.setLngLat(e.lngLat);
      moved.current(e.lngLat.lat, e.lngLat.lng);
    });
    map.current = m;
    pin.current = mk;
    // Ionic creates the page before it is visible, so resize the map whenever its box changes size
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      m.remove();
    };
  }, []);

  // A new GPS reading moves the pin and the map
  useEffect(() => {
    pin.current?.setLngLat([lng, lat]);
    map.current?.easeTo({ center: [lng, lat], duration: 500 });
  }, [lat, lng]);

  return <div ref={el} className="pin-map" />;
}
