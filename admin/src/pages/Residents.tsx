import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCheckbox, IonIcon, IonInput,
  IonLabel, IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, useIonToast,
} from '@ionic/react';
import { add, chevronBack, chevronForward, locationOutline } from 'ionicons/icons';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import AdminPage from '../components/AdminPage';
import FormModal from '../components/FormModal';
import { usePageLoad } from '../hooks';
import type { Barangay, EvacCenter, Resident, ResidentPage, SafetyStatus } from '../types';
import { fmt, pct, SAFETY, timeOf, urlParam } from '../utils';
import { StackBar } from './Dashboard';

type Tab = 'all' | SafetyStatus;
const TABS: Tab[] = ['all', 'safe', 'evacuated', 'need_help', 'unaccounted'];
const AVATAR = ['#16a34a', '#1d4ed8', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#4b5563', '#65a30d', '#0d9488'];

export default function Residents() {
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [barangayId, setBarangayId] = useState(0);
  const [status, setStatus] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResidentPage | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Resident | null>(null);
  const [adding, setAdding] = useState(false);

  // Opened from the dashboard with ?barangay=2 or ?status=unaccounted
  usePageLoad(() => {
    api<Barangay[]>('/barangays')
      .then((list) => {
        setBarangays(list);
        const fromUrl = Number(urlParam('barangay'));
        setBarangayId((cur) => (fromUrl && list.some((b) => b.id === fromUrl) ? fromUrl : cur || list[0]?.id || 0));
      })
      .catch((e) => setError(e.message));
    api<EvacCenter[]>('/evacuation-centers').then(setCenters).catch(() => {});
    const s = urlParam('status') as Tab | null;
    if (s && TABS.includes(s)) setStatus(s);
  });

  const load = () => {
    if (!barangayId) return;
    const q = new URLSearchParams({ barangayId: String(barangayId), page: String(page), pageSize: '15' });
    if (status !== 'all') q.set('status', status);
    if (search) q.set('search', search);
    api<ResidentPage>(`/residents?${q}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [barangayId, status, page, search]);

  const brgy = barangays.find((b) => b.id === barangayId);
  const c = data?.counts;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminPage title="Residents" actions={<IonButton fill="solid" onClick={() => setAdding(true)}><IonIcon slot="start" icon={add} />Add Resident</IonButton>}>
      <div className="between wrap">
        <h1>Brgy. {brgy?.name ?? '…'} — Residents</h1>
        <IonSegment className="brgy-switch" value={String(barangayId)} onIonChange={(e) => { setBarangayId(Number(e.detail.value)); setPage(1); }}>
          {barangays.map((b) => (
            <IonSegmentButton key={b.id} value={String(b.id)}>
              <IonLabel><IonIcon icon={locationOutline} /> {b.name}</IonLabel>
            </IonSegmentButton>
          ))}
        </IonSegment>
      </div>
      {error && <p className="error">{error}</p>}

      {c && (
        <>
          <section className="kpis four">
            <KpiCard label="Total Residents" value={fmt(c.all)} />
            <KpiCard label="Marked Safe" value={fmt(c.safe)} sub={pct(c.safe, c.all)} color="success" />
            <KpiCard label="Evacuated" value={fmt(c.evacuated)} sub={pct(c.evacuated, c.all)} color="primary" />
            <KpiCard label="Unaccounted / Need help" value={fmt(c.unaccounted + c.need_help)} sub={`${fmt(c.need_help)} asking for help`} color="danger" />
          </section>
          <IonCard className="panel">
            <IonCardHeader><IonCardTitle>Accountability — {pct(c.safe + c.evacuated, c.all)} accounted for</IonCardTitle></IonCardHeader>
            <IonCardContent>
              <StackBar parts={[[c.safe, '#16a34a'], [c.evacuated, '#2563eb'], [c.need_help, '#9333ea'], [c.unaccounted, '#dc2626']]} />
            </IonCardContent>
          </IonCard>
        </>
      )}

      <IonCard className="panel">
        <div className="between wrap table-tools">
          <IonSegment scrollable value={status} onIonChange={(e) => { setStatus(e.detail.value as Tab); setPage(1); }}>
            {TABS.map((t) => (
              <IonSegmentButton key={t} value={t}>
                <IonLabel>{t === 'all' ? 'All' : SAFETY[t].label} · {fmt(c?.[t] ?? 0)}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
          <IonSearchbar className="search" placeholder="Search name or ID" debounce={300} value={search}
            onIonInput={(e) => { setSearch(e.detail.value ?? ''); setPage(1); }} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Resident</th><th>Purok / Address</th><th>Age</th><th>Contact</th><th>Status</th><th>Last check-in</th><th>Location</th><th /></tr>
            </thead>
            <tbody>
              {data?.items.map((r, i) => (
                <tr key={r.id} className={r.status === 'unaccounted' || r.status === 'need_help' ? 'row-alert' : ''}>
                  <td>
                    <div className="row">
                      <span className="avatar sm" style={{ background: AVATAR[i % AVATAR.length] }}>{r.firstName[0]}{r.lastName[0]}</span>
                      <div>
                        <b>{r.firstName} {r.lastName}</b>
                        {r.age != null && r.age >= 60 && <IonBadge color="warning" className="tag">Senior</IonBadge>}
                        {r.isPwd && <IonBadge color="warning" className="tag">PWD</IonBadge>}
                        <div className="muted small">{r.residentCode}</div>
                      </div>
                    </div>
                  </td>
                  <td>{[r.purok, r.address].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{r.age ?? '—'}</td>
                  <td>{r.contactNumber ?? '—'}</td>
                  <td><IonBadge color={SAFETY[r.status].color}>{SAFETY[r.status].label}</IonBadge></td>
                  <td className="muted">{r.checkedInAt ? timeOf(r.checkedInAt) : '—'}</td>
                  <td>{r.centerName ?? (r.status === 'safe' ? 'Home' : r.status === 'unaccounted' ? 'Unknown' : '—')}</td>
                  <td><IonButton size="small" fill="outline" onClick={() => setEditing(r)}>Update</IonButton></td>
                </tr>
              ))}
              {data && !data.items.length && <tr><td colSpan={8} className="muted">No residents found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="between pager">
          <span className="muted small">Showing {data?.items.length ?? 0} of {fmt(data?.total ?? 0)} residents</span>
          <div className="row">
            <IonButton size="small" fill="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><IonIcon slot="icon-only" icon={chevronBack} /></IonButton>
            <span className="small">Page {page} of {pages}</span>
            <IonButton size="small" fill="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}><IonIcon slot="icon-only" icon={chevronForward} /></IonButton>
          </div>
        </div>
      </IonCard>

      <StatusForm resident={editing} centers={centers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      <AddResident isOpen={adding} barangays={barangays} defaultBarangay={barangayId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
    </AdminPage>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <IonCard className="kpi">
      <IonCardContent>
        <small className="muted">{label}</small>
        <div className={`kpi-value ${color === 'danger' ? 't-danger' : ''}`}>{value}</div>
        {sub && <small className={`t-${color}`}>{sub}</small>}
      </IonCardContent>
    </IonCard>
  );
}

// Officials can record status for residents without a phone (e.g. seniors seen at the evacuation center)
function StatusForm({ resident, centers, onClose, onSaved }: { resident: Resident | null; centers: EvacCenter[]; onClose: () => void; onSaved: () => void }) {
  const [toast] = useIonToast();
  const [status, setStatus] = useState<Exclude<SafetyStatus, 'unaccounted'>>('safe');
  const [centerId, setCenterId] = useState<number | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (resident) { setStatus('safe'); setCenterId(null); setNote(''); }
  }, [resident]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!resident) return;
    try {
      await api(`/residents/${resident.id}/checkin`, {
        method: 'POST',
        body: { status, evacuationCenterId: status === 'evacuated' ? centerId : null, note: note || null },
      });
      toast({ message: `${resident.firstName}'s status was updated`, duration: 2000, color: 'success' });
      onSaved();
    } catch (err) {
      toast({ message: (err as Error).message, duration: 3000, color: 'danger' });
    }
  }

  return (
    <FormModal isOpen={!!resident} title={`Update status · ${resident?.firstName ?? ''} ${resident?.lastName ?? ''}`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <IonSelect label="Status" labelPlacement="stacked" fill="outline" value={status} onIonChange={(e) => setStatus(e.detail.value)}>
          <IonSelectOption value="safe">Safe</IonSelectOption>
          <IonSelectOption value="evacuated">Evacuated (at a center)</IonSelectOption>
          <IonSelectOption value="need_help">Needs help</IonSelectOption>
        </IonSelect>
        {status === 'evacuated' && (
          <IonSelect label="Evacuation center" labelPlacement="stacked" fill="outline" placeholder="Choose…" value={centerId} onIonChange={(e) => setCenterId(e.detail.value)}>
            {centers.map((c) => <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>)}
          </IonSelect>
        )}
        <IonInput label="Note (optional)" labelPlacement="stacked" fill="outline" placeholder="e.g. Seen by Kagawad Santos at 10 AM"
          value={note} onIonInput={(e) => setNote(e.detail.value ?? '')} />
        <IonButton type="submit" expand="block">Save status</IonButton>
      </form>
    </FormModal>
  );
}

function AddResident({ isOpen, barangays, defaultBarangay, onClose, onSaved }: {
  isOpen: boolean; barangays: Barangay[]; defaultBarangay: number; onClose: () => void; onSaved: () => void;
}) {
  const [toast] = useIonToast();
  const empty = { firstName: '', lastName: '', birthDate: '', sex: '', contactNumber: '', purok: '', address: '', isPwd: false, barangayId: defaultBarangay };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (isOpen) setF({ ...empty, barangayId: defaultBarangay });
  }, [isOpen]);

  const set = (k: keyof typeof f) => (e: CustomEvent) => setF((cur) => ({ ...cur, [k]: e.detail.value ?? '' }));

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/residents', { method: 'POST', body: f });
      toast({ message: `${f.firstName} ${f.lastName} was added`, duration: 2000, color: 'success' });
      onSaved();
    } catch (err) {
      toast({ message: (err as Error).message, duration: 3000, color: 'danger' });
    }
  }

  return (
    <FormModal isOpen={isOpen} title="Add resident" onClose={onClose}>
      <form className="grid-form" onSubmit={save}>
        <IonInput label="First name" labelPlacement="stacked" fill="outline" value={f.firstName} onIonInput={set('firstName')} required />
        <IonInput label="Last name" labelPlacement="stacked" fill="outline" value={f.lastName} onIonInput={set('lastName')} required />
        <IonSelect label="Barangay" labelPlacement="stacked" fill="outline" value={f.barangayId} onIonChange={set('barangayId')}>
          {barangays.map((b) => <IonSelectOption key={b.id} value={b.id}>{b.name}</IonSelectOption>)}
        </IonSelect>
        <IonInput label="Birthday" labelPlacement="stacked" fill="outline" type="date" value={f.birthDate} onIonInput={set('birthDate')} />
        <IonSelect label="Sex" labelPlacement="stacked" fill="outline" value={f.sex} onIonChange={set('sex')}>
          <IonSelectOption value="female">Female</IonSelectOption>
          <IonSelectOption value="male">Male</IonSelectOption>
        </IonSelect>
        <IonInput label="Mobile number" labelPlacement="stacked" fill="outline" type="tel" value={f.contactNumber} onIonInput={set('contactNumber')} />
        <IonInput label="Purok" labelPlacement="stacked" fill="outline" placeholder="Purok 1" value={f.purok} onIonInput={set('purok')} />
        <IonInput label="Street / address" labelPlacement="stacked" fill="outline" value={f.address} onIonInput={set('address')} />
        <IonCheckbox className="full" labelPlacement="end" checked={f.isPwd} onIonChange={(e) => setF((cur) => ({ ...cur, isPwd: e.detail.checked }))}>
          Person with disability (PWD)
        </IonCheckbox>
        <IonButton className="full" type="submit" expand="block">Add resident</IonButton>
      </form>
    </FormModal>
  );
}
