import {
  IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon,
  IonInput, IonModal, IonTitle, IonToggle, IonToolbar, useIonAlert, useIonToast,
} from '@ionic/react';
import { add, arrowBack, businessOutline, locationOutline } from 'ionicons/icons';
import { useState } from 'react';
import { api } from '../api';
import AdminPage from '../components/AdminPage';
import Empty from '../components/Empty';
import LocationPicker, { type Details } from '../components/LocationPicker';
import MapView from '../components/MapView';
import { usePageLoad } from '../hooks';
import type { EvacCenter } from '../types';
import { centerState, fmt, timeAgo } from '../utils';
import { Bar } from './Dashboard';

type Draft = { currentOccupancy: string; capacity: string; isOpen: boolean };

const EMPTY_NEW = { name: '', barangay: '', address: '', lat: '', lng: '', capacity: '', facilities: [] as string[], otherFacility: '' };
const FACILITY_CHOICES = ['Water', 'Electricity', 'Restroom', 'Kitchen', 'Medical', 'Sleeping area', 'Wi-Fi'];

export default function Evacuation() {
  const [toast] = useIonToast();
  const [alert] = useIonAlert();
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<'locate' | 'details'>('locate');
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = useState(EMPTY_NEW);
  const setField = (patch: Partial<typeof EMPTY_NEW>) => setForm((f) => ({ ...f, ...patch }));
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [editingId, setEditingId] = useState<number | null>(null); // the row that is open for editing

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
      setEditingId(null);
      load();
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    }
  }

  // Throw away unsaved changes and go back to the saved numbers
  function cancelEdit(c: EvacCenter) {
    edit(c.id, { currentOccupancy: String(c.currentOccupancy), capacity: String(c.capacity), isOpen: c.isOpen });
    setEditingId(null);
  }

  function confirmDelete(c: EvacCenter) {
    alert({
      header: 'Delete evacuation center?',
      message: `${c.name} will be removed from the admin portal and the resident app. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await api(`/evacuation-centers/${c.id}`, { method: 'DELETE' });
              toast({ message: `Deleted ${c.name}`, duration: 2000, color: 'success' });
              load();
            } catch (e) {
              toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
            }
          },
        },
      ],
    });
  }

  // The pinned place decides name / address / barangay (the admin only confirms them)
  const autoFill = (d: Details) => setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) }));

  const toggleFacility = (name: string) =>
    setField({ facilities: form.facilities.includes(name) ? form.facilities.filter((x) => x !== name) : [...form.facilities, name] });

  function closeAdd() {
    setAdding(false);
    setStep('locate');
    setForm(EMPTY_NEW);
  }

  async function create() {
    const facilities = [...form.facilities, ...form.otherFacility.split(',').map((f) => f.trim()).filter(Boolean)];
    try {
      await api('/evacuation-centers', {
        method: 'POST',
        body: {
          name: form.name,
          barangay: form.barangay,
          address: form.address,
          lat: Number(form.lat),
          lng: Number(form.lng),
          capacity: Number(form.capacity),
          facilities,
        },
      });
      setFocus({ lat: Number(form.lat), lng: Number(form.lng) });
      toast({ message: `Added ${form.name}`, duration: 2000, color: 'success' });
      closeAdd();
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
        <IonCardContent><MapView centers={centers} height={300} focus={focus} /></IonCardContent>
      </IonCard>
      <IonCard className="panel">
        <IonCardHeader className="between">
          <IonCardTitle>Update evacuee counts</IonCardTitle>
          <IonButton size="small" onClick={() => setAdding(true)}><IonIcon slot="start" icon={add} />Add evacuation center</IonButton>
        </IonCardHeader>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Center</th><th>Barangay</th><th>Evacuees now</th><th>Capacity</th><th>Status</th><th>Open</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {centers.map((c) => {
                const d = drafts[c.id];
                const st = centerState(c);
                const editing = editingId === c.id;
                if (!d) return null;
                return (
                  <tr key={c.id}>
                    <td>
                      <b className="link" title="Show on the map" onClick={() => setFocus({ lat: c.lat, lng: c.lng })}><IonIcon icon={locationOutline} className="t-primary" /> {c.name}</b>
                      <div className="tags">{c.facilities.map((f) => <IonBadge key={f} color="light">{f}</IonBadge>)}</div>
                    </td>
                    <td>{c.barangay}</td>
                    <td>
                      {editing
                        ? <IonInput className="num" fill="outline" type="number" min={0} value={d.currentOccupancy} onIonInput={(e) => edit(c.id, { currentOccupancy: e.detail.value ?? '0' })} />
                        : <b>{fmt(c.currentOccupancy)}</b>}
                    </td>
                    <td>
                      {editing
                        ? <IonInput className="num" fill="outline" type="number" min={1} value={d.capacity} onIonInput={(e) => edit(c.id, { capacity: e.detail.value ?? '1' })} />
                        : <b>{fmt(c.capacity)}</b>}
                    </td>
                    <td>
                      <IonBadge color={st.color}>{st.label}</IonBadge>
                      <Bar value={c.currentOccupancy / c.capacity} color={st.bar} />
                    </td>
                    <td><IonToggle checked={d.isOpen} disabled={!editing} onIonChange={(e) => edit(c.id, { isOpen: e.detail.checked })} /></td>
                    <td className="muted small">{timeAgo(c.updatedAt)}</td>
                    <td className="row-actions">
                      {editing ? (
                        <>
                          <IonButton size="small" onClick={() => save(c)}>Save</IonButton>
                          <IonButton size="small" color="medium" fill="outline" onClick={() => cancelEdit(c)}>Cancel</IonButton>
                        </>
                      ) : (
                        <>
                          <IonButton size="small" onClick={() => setEditingId(c.id)}>Edit</IonButton>
                          <IonButton size="small" color="danger" fill="outline" onClick={() => confirmDelete(c)}>Delete</IonButton>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!centers.length && <Empty icon={businessOutline} title="No evacuation centers yet" hint="Tap “Add evacuation center” to pin the first one." />}
        </div>
      </IonCard>

      <IonModal className="form-modal" isOpen={adding} onDidDismiss={closeAdd}>
        <IonHeader>
          <IonToolbar>
            {step === 'details' && (
              <IonButtons slot="start">
                <IonButton onClick={() => setStep('locate')}><IonIcon slot="start" icon={arrowBack} />Back</IonButton>
              </IonButtons>
            )}
            <IonTitle>{step === 'locate' ? 'Where is the evacuation center?' : 'Almost done'}</IonTitle>
            <IonButtons slot="end"><IonButton onClick={closeAdd}>Cancel</IonButton></IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {step === 'locate' ? (
            <>
              <LocationPicker lat={form.lat} lng={form.lng} centers={centers} onChange={(lat, lng) => setField({ lat: String(lat), lng: String(lng) })} onDetails={autoFill} />
              {form.lat && form.lng && (
                <div className="confirm-card">
                  <div className="confirm-place"><IonIcon icon={locationOutline} className="t-danger" /> {form.name || <span className="muted">Unnamed spot</span>}</div>
                  <div className="muted small">{form.address || 'Finding the address…'}</div>
                  {!form.name && (
                    <IonInput className="ion-margin-top" label="Name of this place" labelPlacement="stacked" fill="outline" placeholder="e.g. Ibaba East Covered Court" onIonInput={(e) => setField({ name: e.detail.value ?? '' })} />
                  )}
                  <IonButton className="ion-margin-top" expand="block" disabled={!form.name.trim() || !form.barangay} onClick={() => setStep('details')}>Confirm location</IonButton>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="confirm-card">
                <div className="confirm-place"><IonIcon icon={locationOutline} className="t-danger" /> {form.name}</div>
                <div className="muted small">{form.address}</div>
                <IonButton size="small" fill="clear" onClick={() => setStep('locate')}>Change location</IonButton>
              </div>
              <IonInput className="ion-margin-top" label="Capacity (how many people)" labelPlacement="stacked" fill="outline" type="number" min={1} value={form.capacity} onIonInput={(e) => setField({ capacity: e.detail.value ?? '' })} />
              <h4 className="step ion-margin-top">Facilities</h4>
              <div>
                {FACILITY_CHOICES.map((f) => (
                  <IonChip key={f} color={form.facilities.includes(f) ? 'primary' : undefined} outline={!form.facilities.includes(f)} onClick={() => toggleFacility(f)}>{f}</IonChip>
                ))}
              </div>
              <IonInput className="ion-margin-top" label="Others (separate with commas)" labelPlacement="stacked" fill="outline" placeholder="e.g. Generator, Clinic" value={form.otherFacility} onIonInput={(e) => setField({ otherFacility: e.detail.value ?? '' })} />
              <IonButton className="ion-margin-top" expand="block" disabled={!(Number(form.capacity) > 0)} onClick={create}>Add evacuation center</IonButton>
            </>
          )}
        </IonContent>
      </IonModal>
    </AdminPage>
  );
}
