import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonInputPasswordToggle, IonPage, IonSelect, IonSelectOption,
  IonSpinner, IonTitle, IonToolbar,
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
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/login" /></IonButtons>
          <IonTitle>Create account<span className="header-sub">Takes about a minute</span></IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <form className="auth" onSubmit={submit}>
          <div className="form-group">Where you live</div>
          <IonSelect label="Barangay" labelPlacement="floating" fill="outline" value={form.barangayId || undefined}
            onIonChange={set('barangayId')} interface="action-sheet">
            {barangays.map((b) => <IonSelectOption key={b.id} value={b.id}>Brgy. {b.name}</IonSelectOption>)}
          </IonSelect>
          <IonInput label="Purok" labelPlacement="floating" fill="outline" placeholder="e.g. Purok 1" value={form.purok} onIonInput={set('purok')} />
          <IonInput label="Street / address" labelPlacement="floating" fill="outline" value={form.address} onIonInput={set('address')} />
          <div className="form-group">About you</div>
          <IonInput label="First name" labelPlacement="floating" fill="outline" value={form.firstName} onIonInput={set('firstName')} required />
          <IonInput label="Last name" labelPlacement="floating" fill="outline" value={form.lastName} onIonInput={set('lastName')} required />
          <IonInput label="Birthday" labelPlacement="stacked" fill="outline" type="date" value={form.birthDate} onIonInput={set('birthDate')} />
          <IonSelect label="Sex" labelPlacement="floating" fill="outline" value={form.sex || undefined} onIonChange={set('sex')}>
            <IonSelectOption value="female">Female</IonSelectOption>
            <IonSelectOption value="male">Male</IonSelectOption>
          </IonSelect>
          <IonInput label="Mobile number" labelPlacement="floating" fill="outline" type="tel" value={form.contactNumber} onIonInput={set('contactNumber')} />
          <div className="form-group">Your account</div>
          <IonInput label="Email" labelPlacement="floating" fill="outline" type="email" value={form.email} onIonInput={set('email')} required />
          <IonInput label="Password (min. 8 characters)" labelPlacement="floating" fill="outline" type="password"
            value={form.password} onIonInput={set('password')} required minlength={8}>
            <IonInputPasswordToggle slot="end" />
          </IonInput>
          {error && <div className="error-card">{error}</div>}
          <IonButton type="submit" expand="block" className="auth-button" disabled={busy}>
            {busy ? <><IonSpinner name="crescent" />&nbsp;Creating your account…</> : 'Create account'}
          </IonButton>
          <div className="or-line"><span>Already have an account?</span></div>
          <IonButton expand="block" fill="outline" className="auth-button" routerLink="/login" routerDirection="back" disabled={busy}>
            Log in
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
}
