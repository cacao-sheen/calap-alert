import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonPage, IonSelect, IonSelectOption,
  IonSpinner, IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Barangay } from '../types';

export default function Register() {
  const { register } = useAuth();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', barangayId: 0,
    birthDate: '', sex: '', contactNumber: '', purok: '', address: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Barangay[]>('/barangays').then(setBarangays).catch((e) => setError(e.message));
  }, []);

  const set = (key: keyof typeof form) => (e: CustomEvent) => setForm((f) => ({ ...f, [key]: e.detail.value ?? '' }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.barangayId) return setError('Please choose your barangay');
    setBusy(true);
    try {
      await register({ ...form, barangayId: Number(form.barangayId) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/login" /></IonButtons>
          <IonTitle>Create account</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <form className="auth" onSubmit={submit} style={{ paddingTop: 16 }}>
          <IonSelect label="Barangay" labelPlacement="floating" fill="outline" value={form.barangayId || undefined}
            onIonChange={set('barangayId')} interface="action-sheet">
            {barangays.map((b) => <IonSelectOption key={b.id} value={b.id}>Brgy. {b.name}</IonSelectOption>)}
          </IonSelect>
          <IonInput label="First name" labelPlacement="floating" fill="outline" value={form.firstName} onIonInput={set('firstName')} required />
          <IonInput label="Last name" labelPlacement="floating" fill="outline" value={form.lastName} onIonInput={set('lastName')} required />
          <IonInput label="Birthday" labelPlacement="stacked" fill="outline" type="date" value={form.birthDate} onIonInput={set('birthDate')} />
          <IonSelect label="Sex" labelPlacement="floating" fill="outline" value={form.sex || undefined} onIonChange={set('sex')}>
            <IonSelectOption value="female">Female</IonSelectOption>
            <IonSelectOption value="male">Male</IonSelectOption>
          </IonSelect>
          <IonInput label="Mobile number" labelPlacement="floating" fill="outline" type="tel" value={form.contactNumber} onIonInput={set('contactNumber')} />
          <IonInput label="Purok" labelPlacement="floating" fill="outline" placeholder="e.g. Purok 1" value={form.purok} onIonInput={set('purok')} />
          <IonInput label="Street / address" labelPlacement="floating" fill="outline" value={form.address} onIonInput={set('address')} />
          <IonInput label="Email" labelPlacement="floating" fill="outline" type="email" value={form.email} onIonInput={set('email')} required />
          <IonInput label="Password (min. 8 characters)" labelPlacement="floating" fill="outline" type="password"
            value={form.password} onIonInput={set('password')} required minlength={8} />
          {error && <IonText color="danger"><p className="small">{error}</p></IonText>}
          <IonButton type="submit" expand="block" size="large" disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : 'Create account'}
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
}
