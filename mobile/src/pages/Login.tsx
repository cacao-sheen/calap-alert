import { IonButton, IonContent, IonIcon, IonInput, IonPage, IonRouterLink, IonSpinner, IonText } from '@ionic/react';
import { shieldCheckmark } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

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
        <form className="auth" onSubmit={submit}>
          <div className="logo"><IonIcon icon={shieldCheckmark} /></div>
          <div>
            <h1>Calap Alert</h1>
            <p className="muted">Brgy. Ibaba East &amp; Ibaba West, Calapan City</p>
          </div>
          <IonInput label="Email" labelPlacement="floating" fill="outline" type="email" autocomplete="email"
            value={email} onIonInput={(e) => setEmail(e.detail.value ?? '')} required />
          <IonInput label="Password" labelPlacement="floating" fill="outline" type="password" autocomplete="current-password"
            value={password} onIonInput={(e) => setPassword(e.detail.value ?? '')} required />
          {error && <IonText color="danger"><p className="small">{error}</p></IonText>}
          <IonButton type="submit" expand="block" size="large" disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : 'Log in'}
          </IonButton>
          <p className="muted" style={{ textAlign: 'center' }}>
            New resident? <IonRouterLink routerLink="/register">Create an account</IonRouterLink>
          </p>
        </form>
      </IonContent>
    </IonPage>
  );
}
