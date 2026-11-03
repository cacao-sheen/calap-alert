import {
  IonBadge, IonButton, IonChip, IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSkeletonText, IonTitle, IonToolbar, useIonRouter,
} from '@ionic/react';
import { businessOutline, mapOutline, navigate, walkOutline } from 'ionicons/icons';
import { useState } from 'react';
import { api } from '../api';
import Empty from '../components/Empty';
import { usePageLoad } from '../hooks';
import type { EvacCenter } from '../types';
import { centerStatus, DEFAULT_LOCATION, directionsUrl, distanceKm, formatDistance, getLocation, walkMinutes } from '../utils';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Has space' },
  { value: 'Ibaba East', label: 'Ibaba East' },
  { value: 'Ibaba West', label: 'Ibaba West' },
];

export default function Evac() {
  const router = useIonRouter();
  const [centers, setCenters] = useState<EvacCenter[] | null>(null);
  const [me, setMe] = useState(DEFAULT_LOCATION);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api<EvacCenter[]>('/evacuation-centers')
      .then((c) => { setCenters(c); setError(''); })
      .catch((e) => setError(e.message));

  usePageLoad(() => {
    load();
    getLocation().then((l) => setMe({ lat: l.lat, lng: l.lng }));
  });

  // Nearest first, so the best choice is always on top
  const list = (centers ?? [])
    .map((c) => ({ c, km: distanceKm(me, c) }))
    .filter(({ c }) => filter === 'all' || c.barangay === filter || (filter === 'available' && c.isOpen && c.currentOccupancy < c.capacity))
    .filter(({ c }) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.km - b.km);

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonTitle>Evacuation centers<span className="header-sub">Nearest to you first</span></IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">
          <IonSearchbar placeholder="Search a center" value={search} onIonInput={(e) => setSearch(e.detail.value ?? '')} style={{ padding: 0 }} />
          <div className="filters">
            {FILTERS.map((f) => (
              <IonChip key={f.value} color={filter === f.value ? 'primary' : 'medium'} outline={filter !== f.value} onClick={() => setFilter(f.value)}>
                {f.label}
              </IonChip>
            ))}
          </div>

          {error && <div className="error-card">{error}</div>}
          {centers === null && !error && [0, 1].map((i) => <div key={i} className="card"><IonSkeletonText animated style={{ height: 90 }} /></div>)}

          {list.map(({ c, km }, i) => {
            const st = centerStatus(c);
            const pct = Math.min(100, (c.currentOccupancy / c.capacity) * 100);
            return (
              <div key={c.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="chip-icon solid-icon" style={{ background: st.bar }}><IonIcon icon={businessOutline} /></span>
                  <div className="grow">
                    {i === 0 && filter === 'all' && !search && <div className="small" style={{ color: '#16a34a', fontWeight: 600 }}>Nearest to you</div>}
                    <b>{c.name}</b>
                    <div className="small muted">
                      Brgy. {c.barangay} · {formatDistance(km)} · <IonIcon icon={walkOutline} style={{ verticalAlign: -2 }} /> {walkMinutes(km)} min
                    </div>
                  </div>
                  <IonBadge color={st.color}>{st.label}</IonBadge>
                </div>
                <div>
                  <div className="between small" style={{ marginBottom: 6 }}>
                    <span className="muted">People inside</span>
                    <b>{c.currentOccupancy} / {c.capacity}</b>
                  </div>
                  <div className="bar"><div style={{ width: `${pct}%`, background: st.bar }} /></div>
                </div>
                {c.facilities.length > 0 && <div className="tags">{c.facilities.map((f) => <span key={f} className="tag">{f}</span>)}</div>}
                <div className="two-buttons">
                  <IonButton fill="outline" size="small" onClick={() => router.push(`/tabs/map?focus=${c.id}`)}><IonIcon slot="start" icon={mapOutline} />Show on map</IonButton>
                  <IonButton size="small" href={directionsUrl(c.lat, c.lng)} target="_blank"><IonIcon slot="start" icon={navigate} />Directions</IonButton>
                </div>
              </div>
            );
          })}
          {centers !== null && !list.length && !error && (
            <Empty icon={businessOutline} title="No centers found" hint="Try another filter or search word." />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
