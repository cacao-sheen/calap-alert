import { IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonPage, IonSpinner } from '@ionic/react';
import { megaphoneOutline, peopleOutline, warningOutline } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import LogoMark from '../components/LogoMark';

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
        <div className="login-split">
          <section className="login-brand">
            <div className="login-brand-top">
              <span className="logo-mark"><LogoMark size={32} /></span>
              <b>Calap Alert</b>
            </div>
            <div>
              <h2>Disaster response for Brgy. Ibaba East &amp; Ibaba West</h2>
              <ul>
                <li><IonIcon icon={megaphoneOutline} />Send alerts to residents in seconds</li>
                <li><IonIcon icon={peopleOutline} />See who is safe, evacuated or needs help</li>
                <li><IonIcon icon={warningOutline} />Track incident reports from the field</li>
              </ul>
            </div>
            <small>Calapan City CDRRMO</small>
          </section>

          <section className="login-form-side">
            <form onSubmit={submit} className="login-form stack">
              <span className="logo-mark big login-mobile-logo"><LogoMark size={44} /></span>
              <div>
                <h1>Admin sign in</h1>
                <p className="muted">Use the account given to you by the CDRRMO.</p>
              </div>
              <IonInput label="Email" labelPlacement="floating" fill="outline" type="email" autocomplete="email"
                value={email} onIonInput={(e) => setEmail(e.detail.value ?? '')} required />
              <IonInput label="Password" labelPlacement="floating" fill="outline" type="password" autocomplete="current-password"
                value={password} onIonInput={(e) => setPassword(e.detail.value ?? '')} required>
                <IonInputPasswordToggle slot="end" />
              </IonInput>
              {error && <p className="error">{error}</p>}
              <IonButton type="submit" expand="block" className="login-button" disabled={busy}>
                {busy ? <><IonSpinner name="crescent" />&nbsp;Signing in…</> : 'Sign in'}
              </IonButton>
              <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>Residents use the Calap Alert mobile app.</p>
            </form>
          </section>
        </div>
      </IonContent>
    </IonPage>
  );
}
