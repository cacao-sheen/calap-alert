import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonLabel, IonModal, IonSegment, IonSegmentButton, IonSelect,
  IonSelectOption, IonSpinner, IonTitle, IonToggle, IonToolbar,
} from '@ionic/react';
import { useState, type FormEvent } from 'react';
import { api } from '../api';

const RELATIONSHIPS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Grandchild', 'Relative', 'Other'];
const EMPTY = { email: '', firstName: '', lastName: '', relationship: '', birthDate: '', sex: '', isPwd: false };

type Mode = 'account' | 'manual';
type Props = { isOpen: boolean; onClose: () => void; onDone: (message: string) => void };

export default function AddMemberModal({ isOpen, onClose, onDone }: Props) {
  const [mode, setMode] = useState<Mode>('account');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: CustomEvent) => setForm((f) => ({ ...f, [key]: e.detail.value ?? '' }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.relationship) return setError('Please choose how they are related to you');
    setBusy(true);
    try {
      if (mode === 'account') {
        await api('/household/invites', { method: 'POST', body: { email: form.email, relationship: form.relationship } });
      } else {
        const { email, ...member } = form;
        await api('/household/members', { method: 'POST', body: member });
      }
      setForm(EMPTY);
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
                Enter the email they used to sign up. They will get an invite and join your household once they accept.
              </p>
              <IonInput label="Their email" labelPlacement="floating" fill="outline" type="email" value={form.email} onIonInput={set('email')} required />
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
