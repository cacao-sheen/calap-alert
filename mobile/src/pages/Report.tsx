import {
  IonButton, IonContent, IonHeader, IonIcon, IonInput, IonLabel, IonPage, IonSegment, IonSegmentButton,
  IonSpinner, IonTextarea, IonTitle, IonToolbar, useIonRouter, useIonToast,
} from '@ionic/react';
import { cameraOutline, closeCircle, locateOutline, send } from 'ionicons/icons';
import { useRef, useState } from 'react';
import { api } from '../api';
import { usePageLoad } from '../hooks';
import type { Incident, IncidentType } from '../types';
import { getLocation, INCIDENT_TYPES, resizeImage } from '../utils';

export default function Report() {
  const router = useIonRouter();
  const [toast] = useIonToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loc, setLoc] = useState<{ lat: number; lng: number; fromGps: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  usePageLoad(() => {
    getLocation().then(setLoc);
  });

  async function pickPhoto(file?: File) {
    if (!file) return;
    try {
      setPhoto(await resizeImage(file));
    } catch (e) {
      toast({ message: (e as Error).message, duration: 2500, color: 'danger' });
    }
  }

  async function submit() {
    if (!type) return toast({ message: 'Choose what happened', duration: 2000, color: 'warning' });
    if (!description.trim()) return toast({ message: 'Describe the incident', duration: 2000, color: 'warning' });
    setBusy(true);
    try {
      const inc = await api<Incident>('/incidents', {
        method: 'POST',
        body: { type, description, severity, address: address || null, lat: loc?.lat, lng: loc?.lng, photo },
      });
      setType(null);
      setDescription('');
      setAddress('');
      setPhoto(null);
      setSeverity('medium');
      router.push(`/tabs/result/report?code=${encodeURIComponent(inc.code)}`);
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Report an Incident</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="page-pad">
          <div className="section-title">What happened?</div>
          <div className="type-grid">
            {INCIDENT_TYPES.map((t) => (
              <button key={t.type} className={`type-tile ${type === t.type ? 'selected' : ''}`} onClick={() => setType(t.type)}>
                <span className="chip-icon" style={{ background: t.bg, color: t.color }}><IonIcon icon={t.icon} /></span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="card row" style={{ padding: 14 }}>
            <span className="chip-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}><IonIcon icon={locateOutline} /></span>
            <div className="grow">
              <div className="small muted">{loc?.fromGps ? 'Your current location (GPS)' : 'GPS not available, using barangay center'}</div>
              <b className="small">{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'Getting location…'}</b>
            </div>
            <IonButton fill="clear" size="small" onClick={() => getLocation().then(setLoc)}>Refresh</IonButton>
          </div>
          <IonInput label="Street or landmark (optional)" labelPlacement="floating" fill="outline"
            placeholder="e.g. corner of J.P. Rizal and Del Pilar" value={address} onIonInput={(e) => setAddress(e.detail.value ?? '')} />

          <div className="section-title">Describe the incident</div>
          <IonTextarea fill="outline" rows={4} placeholder="Ano ang nangyari? What do responders need to know?"
            value={description} onIonInput={(e) => setDescription(e.detail.value ?? '')} />

          <div className="section-title">How serious is it?</div>
          <IonSegment value={severity} onIonChange={(e) => setSeverity(e.detail.value as typeof severity)}>
            <IonSegmentButton value="low"><IonLabel>Low</IonLabel></IonSegmentButton>
            <IonSegmentButton value="medium"><IonLabel>Medium</IonLabel></IonSegmentButton>
            <IonSegmentButton value="high"><IonLabel>High</IonLabel></IonSegmentButton>
          </IonSegment>

          <div className="photo-row">
            <button className="photo-add" onClick={() => fileInput.current?.click()}>
              <IonIcon icon={cameraOutline} style={{ fontSize: 22 }} />
              {photo ? 'Change' : 'Add photo'}
            </button>
            {photo && (
              <div style={{ position: 'relative' }}>
                <img className="photo-thumb" src={photo} alt="Incident" />
                <IonIcon icon={closeCircle} style={{ position: 'absolute', top: -6, right: -6, fontSize: 22, color: '#dc2626' }} onClick={() => setPhoto(null)} />
              </div>
            )}
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>

          <IonButton expand="block" size="large" color="danger" onClick={submit} disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={send} />Submit Report</>}
          </IonButton>
          <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
            Your report goes to Calapan CDRRMO and your barangay officials.
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
}
