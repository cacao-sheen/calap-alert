import { IonButton, IonContent, IonInput, IonInputPasswordToggle, IonPage, IonSpinner } from '@ionic/react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import LogoMark from '../components/LogoMark';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonContent>
        <div className="auth-top">
          <div className="logo-tile"><LogoMark size={44} /></div>
          <h1>Calap Alert</h1>
          <p>Brgy. Ibaba East &amp; Ibaba West, Calapan City</p>
        </div>
        <form className="auth-card" onSubmit={submit}>
          <div>
            <h2>Welcome back</h2>
            <p className="small muted" style={{ margin: '2px 0 0' }}>Log in to get alerts and check in during disasters.</p>
          </div>
          <IonInput label="Email" labelPlacement="floating" fill="outline" type="email" autocomplete="email"
            value={email} onIonInput={(e) => setEmail(e.detail.value ?? '')} required />
          <IonInput label="Password" labelPlacement="floating" fill="outline" type="password" autocomplete="current-password"
            value={password} onIonInput={(e) => setPassword(e.detail.value ?? '')} required>
            <IonInputPasswordToggle slot="end" />
          </IonInput>
          {error && <div className="error-card">{error}</div>}
          <IonButton type="submit" expand="block" className="auth-button" disabled={busy}>
            {busy ? <><IonSpinner name="crescent" />&nbsp;Logging in…</> : 'Log in'}
          </IonButton>
          <div className="or-line"><span>New to Calap Alert?</span></div>
          <IonButton expand="block" fill="outline" className="auth-button" routerLink="/register" disabled={busy}>
            Create an account
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
}
