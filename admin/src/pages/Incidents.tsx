import {
  IonBadge, IonButton, IonCard, IonCardContent, IonChip, IonIcon, IonInput, IonItem, IonLabel, IonList,
  IonSelect, IonSelectOption, useIonToast,
} from '@ionic/react';
import { checkmarkCircle, refresh } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import AdminPage from '../components/AdminPage';
import MapView from '../components/MapView';
import { usePageLoad } from '../hooks';
import type { Barangay, Incident, IncidentDetail, IncidentStatus, IncidentType } from '../types';
import { INCIDENT_INFO, INCIDENT_STATUS, timeAgo, timeOf, urlParam } from '../utils';

// What the admin can do next for each status
const NEXT: Record<IncidentStatus, { to: IncidentStatus; label: string; color: string; fill?: 'outline' }[]> = {
  pending: [{ to: 'verified', label: '✓ Verify report', color: 'primary' }, { to: 'resolved', label: 'Close (false report)', color: 'medium', fill: 'outline' }],
  verified: [{ to: 'responding', label: '🚒 Dispatch team', color: 'primary' }],
  responding: [{ to: 'resolved', label: '✓ Mark resolved', color: 'success' }],
  resolved: [{ to: 'responding', label: 'Reopen', color: 'medium', fill: 'outline' }],
};

export default function Incidents() {
  const [toast] = useIonToast();
  const [status, setStatus] = useState('active');
  const [type, setType] = useState<IncidentType | ''>('');
  const [barangayId, setBarangayId] = useState('all');
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [list, setList] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [note, setNote] = useState('');

  const loadList = useCallback(() => {
    const q = new URLSearchParams({ limit: '100' });
    if (status !== 'all') q.set('status', status);
    if (type) q.set('type', type);
    if (barangayId !== 'all') q.set('barangayId', barangayId);
    api<Incident[]>(`/incidents?${q}`).then(setList).catch((e) => toast({ message: e.message, duration: 3000, color: 'danger' }));
  }, [status, type, barangayId, toast]);

  // Opened from the dashboard with ?id=5
  usePageLoad(() => {
    api<Barangay[]>('/barangays').then(setBarangays).catch(() => {});
    const id = Number(urlParam('id'));
    if (id) setSelectedId(id);
  });

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, 30_000);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return setDetail(null);
    api<IncidentDetail>(`/incidents/${selectedId}`).then(setDetail).catch((e) => toast({ message: e.message, duration: 3000, color: 'danger' }));
  }, [selectedId, toast]);

  async function changeStatus(to: IncidentStatus) {
    if (!detail) return;
    try {
      await api(`/incidents/${detail.id}/status`, { method: 'PATCH', body: { status: to, note: note || null } });
      setNote('');
      setDetail(await api<IncidentDetail>(`/incidents/${detail.id}`));
      loadList();
      toast({ message: `Incident marked as ${INCIDENT_STATUS[to].label.toLowerCase()}`, duration: 2000, color: 'success' });
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    }
  }

  const counts = list.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.type]: (acc[i.type] ?? 0) + 1 }), {});

  return (
    <AdminPage title="Incident Reports" actions={<IonButton onClick={loadList}><IonIcon slot="start" icon={refresh} />Refresh</IonButton>}>
      <div className="between wrap">
        <p className="muted subtitle">{list.length} shown · Brgy. Ibaba East &amp; Ibaba West</p>
        <div className="row">
          <IonSelect className="filter" label="Barangay" labelPlacement="stacked" fill="outline" interface="popover" value={barangayId} onIonChange={(e) => setBarangayId(e.detail.value)}>
            <IonSelectOption value="all">Both barangays</IonSelectOption>
            {barangays.map((b) => <IonSelectOption key={b.id} value={String(b.id)}>Brgy. {b.name}</IonSelectOption>)}
          </IonSelect>
          <IonSelect className="filter" label="Status" labelPlacement="stacked" fill="outline" interface="popover" value={status} onIonChange={(e) => setStatus(e.detail.value)}>
            <IonSelectOption value="active">Active (not resolved)</IonSelectOption>
            <IonSelectOption value="all">All</IonSelectOption>
            {Object.entries(INCIDENT_STATUS).map(([k, v]) => <IonSelectOption key={k} value={k}>{v.label}</IonSelectOption>)}
          </IonSelect>
        </div>
      </div>

      <div className="chips">
        <IonChip color={type === '' ? 'dark' : 'medium'} outline={type !== ''} onClick={() => setType('')}>All · {list.length}</IonChip>
        {(Object.keys(INCIDENT_INFO) as IncidentType[]).map((t) => (
          <IonChip key={t} color={type === t ? 'dark' : 'medium'} outline={type !== t} onClick={() => setType(t)}>
            {INCIDENT_INFO[t].emoji} {INCIDENT_INFO[t].label}{counts[t] ? ` · ${counts[t]}` : ''}
          </IonChip>
        ))}
      </div>

      <div className="row-2">
        <IonCard className="panel grow">
          <IonList lines="full">
            {list.map((i) => (
              <IonItem key={i.id} button detail={false} className={i.id === selectedId ? 'selected-item' : ''} onClick={() => setSelectedId(i.id)}>
                <span slot="start" className="type-chip lg" style={{ background: INCIDENT_INFO[i.type].bg }}>{INCIDENT_INFO[i.type].emoji}</span>
                <IonLabel className="ion-text-wrap">
                  <h3><b>{INCIDENT_INFO[i.type].label} · {i.address ?? `Brgy. ${i.barangay ?? '—'}`}</b></h3>
                  <p>{i.description}</p>
                  <p className="small">
                    👤 {i.reporterName ?? 'Unknown'} · 🕒 {timeOf(i.createdAt)} ({timeAgo(i.createdAt)})
                    {i.severity === 'high' && <b className="t-danger"> · High severity</b>}
                  </p>
                </IonLabel>
                <IonBadge slot="end" color={INCIDENT_STATUS[i.status].color}>{INCIDENT_STATUS[i.status].label}</IonBadge>
              </IonItem>
            ))}
            {!list.length && <IonItem><IonLabel className="muted">No incidents match these filters.</IonLabel></IonItem>}
          </IonList>
        </IonCard>

        <IonCard className="panel detail">
          <IonCardContent className="stack">
            {!detail ? (
              <p className="muted">Select an incident to see details.</p>
            ) : (
              <>
                <div className="between">
                  <IonBadge color={INCIDENT_STATUS[detail.status].color}>{INCIDENT_STATUS[detail.status].label}</IonBadge>
                  <small className="muted">{detail.code}</small>
                </div>
                <h2>{INCIDENT_INFO[detail.type].label} — {detail.address ?? `Brgy. ${detail.barangay}`}</h2>
                {detail.photo && <img src={detail.photo} alt="Reported" className="photo" />}
                {detail.lat != null && detail.lng != null && (
                  <MapView incidents={[detail]} height={180} focus={{ lat: detail.lat, lng: detail.lng }} zoom={16.5} />
                )}
                <div className="grid-2">
                  <div className="stat"><small>Reported by</small><b>{detail.reporterName ?? '—'}</b></div>
                  <div className="stat"><small>Time</small><b>{timeOf(detail.createdAt)}</b></div>
                  <div className="stat"><small>Severity</small><b className={detail.severity === 'high' ? 't-danger' : ''}>{detail.severity}</b></div>
                  <div className="stat"><small>Barangay</small><b>{detail.barangay ?? '—'}</b></div>
                </div>
                <p className="quote">“{detail.description}”</p>
                <b>Response timeline</b>
                <IonList lines="none" className="timeline">
                  {detail.updates.map((u) => (
                    <IonItem key={u.id}>
                      <IonIcon slot="start" icon={checkmarkCircle} color="success" />
                      <IonLabel className="ion-text-wrap">
                        <b>{INCIDENT_STATUS[u.status].label}</b>{u.note ? ` — ${u.note}` : ''}
                        {u.byName && <p>{u.byName}</p>}
                      </IonLabel>
                      <small slot="end" className="muted">{timeOf(u.createdAt)}</small>
                    </IonItem>
                  ))}
                </IonList>
                <IonInput fill="outline" label="Note for this update (optional)" labelPlacement="stacked"
                  placeholder="e.g. Rescue Team Alpha" value={note} onIonInput={(e) => setNote(e.detail.value ?? '')} />
                <div className="row">
                  {NEXT[detail.status].map((a) => (
                    <IonButton key={a.to} className="grow" color={a.color} fill={a.fill ?? 'solid'} onClick={() => changeStatus(a.to)}>{a.label}</IonButton>
                  ))}
                </div>
              </>
            )}
          </IonCardContent>
        </IonCard>
      </div>
    </AdminPage>
  );
}
