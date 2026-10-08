import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonInput, IonToggle, useIonToast,
} from '@ionic/react';
import { useState } from 'react';
import { api } from '../api';
import AdminPage from '../components/AdminPage';
import MapView from '../components/MapView';
import { usePageLoad } from '../hooks';
import type { EvacCenter } from '../types';
import { centerState, fmt, timeAgo } from '../utils';
import { Bar } from './Dashboard';

type Draft = { currentOccupancy: string; capacity: string; isOpen: boolean };

export default function Evacuation() {
  const [toast] = useIonToast();
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  const load = () =>
    api<EvacCenter[]>('/evacuation-centers')
      .then((list) => {
        setCenters(list);
        setDrafts(Object.fromEntries(list.map((c) => [c.id, { currentOccupancy: String(c.currentOccupancy), capacity: String(c.capacity), isOpen: c.isOpen }])));
      })
      .catch((e) => toast({ message: e.message, duration: 3000, color: 'danger' }));

  usePageLoad(load);

  const edit = (id: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  async function save(c: EvacCenter) {
    const d = drafts[c.id];
    try {
      await api(`/evacuation-centers/${c.id}`, {
        method: 'PATCH',
        body: { currentOccupancy: Number(d.currentOccupancy), capacity: Number(d.capacity), isOpen: d.isOpen },
      });
      toast({ message: `Saved ${c.name}`, duration: 2000, color: 'success' });
      load();
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    }
  }

  const total = centers.reduce((a, c) => a + c.currentOccupancy, 0);
  const capacity = centers.reduce((a, c) => a + c.capacity, 0);

  return (
    <AdminPage title="Evacuation Centers">
      <p className="muted subtitle">{fmt(total)} / {fmt(capacity)} evacuees · residents see these numbers in the Calap Alert app</p>
      <IonCard className="panel">
        <IonCardContent><MapView centers={centers} height={300} /></IonCardContent>
      </IonCard>
      <IonCard className="panel">
        <IonCardHeader><IonCardTitle>Update evacuee counts</IonCardTitle></IonCardHeader>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Center</th><th>Barangay</th><th>Evacuees now</th><th>Capacity</th><th>Status</th><th>Open</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {centers.map((c) => {
                const d = drafts[c.id];
                const st = centerState(c);
                if (!d) return null;
                return (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                      <div className="tags">{c.facilities.map((f) => <IonBadge key={f} color="light">{f}</IonBadge>)}</div>
                    </td>
                    <td>{c.barangay}</td>
                    <td><IonInput className="num" fill="outline" type="number" min={0} value={d.currentOccupancy} onIonInput={(e) => edit(c.id, { currentOccupancy: e.detail.value ?? '0' })} /></td>
                    <td><IonInput className="num" fill="outline" type="number" min={1} value={d.capacity} onIonInput={(e) => edit(c.id, { capacity: e.detail.value ?? '1' })} /></td>
                    <td>
                      <IonBadge color={st.color}>{st.label}</IonBadge>
                      <Bar value={c.currentOccupancy / c.capacity} color={st.bar} />
                    </td>
                    <td><IonToggle checked={d.isOpen} onIonChange={(e) => edit(c.id, { isOpen: e.detail.checked })} /></td>
                    <td className="muted small">{timeAgo(c.updatedAt)}</td>
                    <td><IonButton size="small" onClick={() => save(c)}>Save</IonButton></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </IonCard>
    </AdminPage>
  );
}
