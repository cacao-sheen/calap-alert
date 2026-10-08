import {
  IonBadge, IonContent, IonHeader, IonIcon, IonLabel, IonPage, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSegment, IonSegmentButton, IonTitle, IonToolbar, useIonRouter,
} from '@ionic/react';
import { businessOutline } from 'ionicons/icons';
import { useState } from 'react';
import { api } from '../api';
import { usePageLoad } from '../hooks';
import type { EvacCenter } from '../types';
import { centerStatus, DEFAULT_LOCATION, distanceKm, formatDistance, getLocation } from '../utils';

export default function Evac() {
  const router = useIonRouter();
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [me, setMe] = useState(DEFAULT_LOCATION);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api<EvacCenter[]>('/evacuation-centers').then(setCenters).catch((e) => setError(e.message));

  usePageLoad(() => {
    load();
    getLocation().then((l) => setMe({ lat: l.lat, lng: l.lng }));
  });

  const list = centers
    .map((c) => ({ c, km: distanceKm(me, c) }))
    .filter(({ c }) => filter === 'all' || c.barangay === filter || (filter === 'available' && c.isOpen && c.currentOccupancy < c.capacity))
    .filter(({ c }) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.km - b.km);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Evacuation Centers</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar placeholder="Search evacuation center" value={search} onIonInput={(e) => setSearch(e.detail.value ?? '')} />
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={filter} scrollable onIonChange={(e) => setFilter(String(e.detail.value))}>
            <IonSegmentButton value="all"><IonLabel>All · {centers.length}</IonLabel></IonSegmentButton>
            <IonSegmentButton value="Ibaba East"><IonLabel>Ibaba East</IonLabel></IonSegmentButton>
            <IonSegmentButton value="Ibaba West"><IonLabel>Ibaba West</IonLabel></IonSegmentButton>
            <IonSegmentButton value="available"><IonLabel>Available</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">
          {error && <div className="card" style={{ color: '#b91c1c' }}>{error}</div>}
          {list.map(({ c, km }) => {
            const st = centerStatus(c);
            const pct = Math.min(100, (c.currentOccupancy / c.capacity) * 100);
            return (
              <div key={c.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
                onClick={() => router.push(`/tabs/map?focus=${c.id}`)}>
                <div className="row">
                  <span className="chip-icon" style={{ background: '#dcfce7', color: st.bar, borderRadius: 12 }}><IonIcon icon={businessOutline} /></span>
                  <div className="grow">
                    <b>{c.name}</b>
                    <div className="small muted">Brgy. {c.barangay} · {formatDistance(km)}</div>
                  </div>
                  <IonBadge color={st.color}>{st.label}</IonBadge>
                </div>
                <div className="between small">
                  <span className="muted">Capacity</span>
                  <b>{c.currentOccupancy} / {c.capacity} evacuees</b>
                </div>
                <div className="bar"><div style={{ width: `${pct}%`, background: st.bar }} /></div>
                <div className="tags">{c.facilities.map((f) => <span key={f} className="tag">{f}</span>)}</div>
              </div>
            );
          })}
          {!list.length && !error && <p className="muted" style={{ textAlign: 'center' }}>No evacuation centers found.</p>}
        </div>
      </IonContent>
    </IonPage>
  );
}
