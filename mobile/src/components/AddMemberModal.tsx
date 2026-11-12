import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonModal, IonSegment,
  IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar,
} from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { AccountMatch } from '../types';

const RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Grandchild', 'Relative', 'Other'];
const EMPTY = { lookup: '', firstName: '', lastName: '', relationship: '', birthDate: '', sex: '', isPwd: false };

type Mode = 'account' | 'manual';
type Props = { isOpen: boolean; onClose: () => void; onDone: (message: string) => void };

export default function AddMemberModal({ isOpen, onClose, onDone }: Props) {
  const [mode, setMode] = useState<Mode>('account');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<AccountMatch[] | null>(null);
  const [picked, setPicked] = useState<AccountMatch | null>(null);
  const [searching, setSearching] = useState(false);

  const set = (key: keyof typeof form) => (e: CustomEvent) => setForm((f) => ({ ...f, [key]: e.detail.value ?? '' }));

  // null = nothing searched yet; [] = searched, no match
  async function search(q: string) {
    setForm((f) => ({ ...f, lookup: q }));
    setPicked(null);
    if (q.trim().length < 3) return setMatches(null);
    setSearching(true);
    try {
      setMatches(await api<AccountMatch[]>(`/household/search?q=${encodeURIComponent(q.trim())}`));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'account' && !picked) return setError('Search for their account and tap their name');
    if (!form.relationship) return setError('Please choose how they are related to you');
    setBusy(true);
    try {
      if (mode === 'account') {
        await api('/household/invites', { method: 'POST', body: { residentId: picked!.id, relationship: form.relationship } });
      } else {
        const { lookup, ...member } = form;
        await api('/household/members', { method: 'POST', body: member });
      }
      setForm(EMPTY);
      setMatches(null);
      setPicked(null);
      onDone(mode === 'account' ? 'Invite sent. They will join once they accept.' : 'Family member added');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const relationshipSelect = (
    <IonSelect label="Relationship to you" labelPlacement="floating" fill="outline" interface="action-sheet"
      value={form.relationship || undefined} onIonChange={set('relationship')}>
      {RELATIONSHIPS.map((r) => <IonSelectOption key={r} value={r}>{r}</IonSelectOption>)}
    </IonSelect>
  );

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonTitle>Add family member</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onClose}>Cancel</IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <form className="auth" onSubmit={submit}>
          <IonSegment value={mode} onIonChange={(e) => { setMode(e.detail.value as Mode); setError(''); }}>
            <IonSegmentButton value="account"><IonLabel>Has an account</IonLabel></IonSegmentButton>
            <IonSegmentButton value="manual"><IonLabel>No account</IonLabel></IonSegmentButton>
          </IonSegment>

          {mode === 'account' ? (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                Search for their account, then tap their name. They will get an invite and join your household once they accept.
              </p>
              <IonInput label="Their email or full name" labelPlacement="floating" fill="outline" debounce={400}
                value={form.lookup} onIonInput={(e) => search(e.detail.value ?? '')} />
              {searching && <p className="small muted" style={{ margin: 0 }}>Searching…</p>}
              {matches && matches.length === 0 && (
                <p className="small muted" style={{ margin: 0 }}>No account found. Check the spelling, or type their full email.</p>
              )}
              {matches && matches.length > 0 && (
                <IonList inset={false} lines="full" style={{ borderRadius: 12 }}>
                  {matches.map((m) => (
                    <IonItem key={m.id} button detail={false} onClick={() => setPicked(m)}>
                      <IonLabel>
                        <b>{m.name}</b>
                        <p>Brgy. {m.barangay}{m.purok ? ` · ${m.purok}` : ''}</p>
                      </IonLabel>
                      {picked?.id === m.id && <IonIcon slot="end" color="primary" icon={checkmarkCircle} />}
                    </IonItem>
                  ))}
                </IonList>
              )}
              {relationshipSelect}
            </>
          ) : (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                For family without a phone, like children or seniors. Your barangay can mark their status during a disaster.
              </p>
              <IonInput label="First name" labelPlacement="floating" fill="outline" value={form.firstName} onIonInput={set('firstName')} required />
              <IonInput label="Last name" labelPlacement="floating" fill="outline" value={form.lastName} onIonInput={set('lastName')} required />
              {relationshipSelect}
              <IonInput label="Birthday" labelPlacement="stacked" fill="outline" type="date" value={form.birthDate} onIonInput={set('birthDate')} />
              <IonSelect label="Sex" labelPlacement="floating" fill="outline" value={form.sex || undefined} onIonChange={set('sex')}>
                <IonSelectOption value="female">Female</IonSelectOption>
                <IonSelectOption value="male">Male</IonSelectOption>
              </IonSelect>
              <IonToggle checked={form.isPwd} onIonChange={(e) => setForm((f) => ({ ...f, isPwd: e.detail.checked }))}>
                Person with disability (PWD)
              </IonToggle>
            </>
          )}

          {error && <div className="error-card">{error}</div>}
          <IonButton type="submit" expand="block" className="auth-button" disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : mode === 'account' ? 'Send invite' : 'Add to household'}
          </IonButton>
        </form>
      </IonContent>
    </IonModal>
  );
}
