import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonInput, IonPage, IonSpinner, IonText } from '@ionic/react';
import { megaphone } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { api } from '../api';

type LoginResponse = { token: string; user: { role: string; name?: string } };

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
      if (r.user.role !== 'admin') throw new Error('This portal is for admins only. Residents use the Calap Alert app.');
      localStorage.setItem('admin_token', r.token);
      localStorage.setItem('admin_name', r.user.name ?? 'Admin');
      onLogin(r.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonContent className="login-bg">
        <div className="login-wrap">
          <IonCard className="login-card">
            <IonCardContent>
              <form onSubmit={submit} className="stack">
                <span className="logo-mark big"><IonIcon icon={megaphone} /></span>
                <div>
                  <h1>Calap Alert</h1>
                  <p className="muted">Admin portal · Brgy. Ibaba East &amp; Ibaba West</p>
                </div>
                <IonInput label="Email" labelPlacement="floating" fill="outline" type="email" autocomplete="email"
                  value={email} onIonInput={(e) => setEmail(e.detail.value ?? '')} required />
                <IonInput label="Password" labelPlacement="floating" fill="outline" type="password" autocomplete="current-password"
                  value={password} onIonInput={(e) => setPassword(e.detail.value ?? '')} required />
                {error && <IonText color="danger"><p>{error}</p></IonText>}
                <IonButton type="submit" expand="block" size="large" disabled={busy}>
                  {busy ? <IonSpinner name="crescent" /> : 'Log in'}
                </IonButton>
              </form>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
