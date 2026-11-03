import {
  IonButton, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonPage, IonSpinner, IonTextarea, IonTitle, IonToolbar,
  useIonRouter, useIonToast,
} from '@ionic/react';
import { cameraOutline, closeCircle, locateOutline, refreshOutline, send } from 'ionicons/icons';
import { useRef, useState, type CSSProperties } from 'react';
import { api } from '../api';
import PinMap from '../components/PinMap';
import { usePageLoad } from '../hooks';
import type { Incident, IncidentType } from '../types';
import { getLocation, INCIDENT_TYPES, resizeImage, type Fix } from '../utils';

type Severity = 'low' | 'medium' | 'high';
const SEVERITY: { value: Severity; label: string; hint: string; color: string }[] = [
  { value: 'low', label: 'Low', hint: 'No one hurt', color: '#16a34a' },
  { value: 'medium', label: 'Medium', hint: 'Needs action', color: '#d97706' },
  { value: 'high', label: 'High', hint: 'Lives at risk', color: '#dc2626' },
];

type Loc = Fix & { street?: string | null; moved?: boolean };

export default function Report() {
  const router = useIonRouter();
  const [toast] = useIonToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [busy, setBusy] = useState(false);

  // GPS position, plus the street name so residents see a place instead of numbers
  async function locate() {
    setLoc(null);
    const l = await getLocation(true);
    setLoc(l);
    lookUpStreet(l);
  }

  async function lookUpStreet(l: Loc) {
    const r = await api<{ street: string | null }>(`/street?lat=${l.lat}&lng=${l.lng}`).catch(() => null);
    setLoc((cur) => (cur && cur.lat === l.lat && cur.lng === l.lng ? { ...cur, street: r?.street ?? null } : cur));
  }

  // The resident dragged the pin to the exact spot
  function movePin(lat: number, lng: number) {
    const l: Loc = { lat, lng, fromGps: false, accuracy: null, moved: true };
    setLoc(l);
    lookUpStreet(l);
  }

  usePageLoad(() => {
    locate();
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
    if (!type) return toast({ message: 'Step 1: choose what happened', duration: 2000, color: 'warning' });
    if (!description.trim()) return toast({ message: 'Step 3: describe what happened', duration: 2000, color: 'warning' });
    setBusy(true);
    try {
      const inc = await api<Incident>('/incidents', {
        method: 'POST',
        body: { type, description, severity, address: address || loc?.street || null, lat: loc?.lat, lng: loc?.lng, photo },
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

  const ready = !!type && !!description.trim();

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonTitle>Report an incident<span className="header-sub">Goes straight to Calapan CDRRMO</span></IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="page-pad">
          <div className="step-title"><span className="num">1</span>What happened?</div>
          <div className="type-grid">
            {INCIDENT_TYPES.map((t) => (
              <button key={t.type} className={`type-tile ${type === t.type ? 'selected' : ''}`} style={{ '--c': t.color } as CSSProperties} onClick={() => setType(t.type)}>
                <span className="chip-icon solid-icon" style={{ background: t.color }}><IonIcon icon={t.icon} /></span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="step-title"><span className="num">2</span>Where is it?</div>
          <div className="card row" style={{ padding: 14 }}>
            <span className="chip-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><IonIcon icon={locateOutline} /></span>
            <div className="grow">
              <div className="small muted">
                {!loc ? 'Finding your exact location… (a few seconds)'
                  : loc.moved ? 'Pinned by you'
                  : loc.fromGps ? `Your location (GPS · within ${Math.round(loc.accuracy ?? 0)} m)`
                  : 'GPS is off · drag the pin to the spot'}
              </div>
              <b className="small">{loc ? loc.street ?? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : <IonSpinner name="dots" />}</b>
            </div>
            <IonButton fill="clear" size="small" onClick={locate} aria-label="Refresh location"><IonIcon slot="icon-only" icon={refreshOutline} /></IonButton>
          </div>
          {loc && <PinMap lat={loc.lat} lng={loc.lng} onMove={movePin} />}
          {loc && <div className="small muted" style={{ marginTop: -8 }}>Not the right spot? Drag the red pin or tap the map.</div>}
          {loc?.fromGps && (loc.accuracy ?? 0) > 50 && (
            <div className="small" style={{ color: '#b45309', marginTop: -8 }}>GPS is not precise right now. Please check the pin.</div>
          )}
          <IonInput label="Street or landmark (optional)" labelPlacement="floating" fill="outline"
            placeholder="e.g. corner of J.P. Rizal and Del Pilar" value={address} onIonInput={(e) => setAddress(e.detail.value ?? '')} />

          <div className="step-title"><span className="num">3</span>Tell us more</div>
          <IonTextarea fill="outline" rows={4} label="What do responders need to know?" labelPlacement="floating"
            placeholder="Ano ang nangyari? e.g. Knee-deep flood, 2 cars stuck"
            value={description} onIonInput={(e) => setDescription(e.detail.value ?? '')} />
          <div className="small muted" style={{ marginBottom: -6 }}>How serious is it?</div>
          <div className="severity">
            {SEVERITY.map((s) => (
              <button key={s.value} className={severity === s.value ? 'on' : ''} style={{ '--c': s.color } as CSSProperties} onClick={() => setSeverity(s.value)}>
                {s.label}<small>{s.hint}</small>
              </button>
            ))}
          </div>

          <div className="step-title"><span className="num">4</span>Add a photo <span className="opt">(optional)</span></div>
          <div className="photo-row">
            <button className="photo-add" onClick={() => fileInput.current?.click()}>
              <IonIcon icon={cameraOutline} style={{ fontSize: 24 }} />
              {photo ? 'Change' : 'Take photo'}
            </button>
            {photo && (
              <div style={{ position: 'relative' }}>
                <img className="photo-thumb" src={photo} alt="Incident" />
                <IonIcon icon={closeCircle} style={{ position: 'absolute', top: -8, right: -8, fontSize: 24, color: '#dc2626', background: '#fff', borderRadius: '50%' }} onClick={() => setPhoto(null)} />
              </div>
            )}
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </div>
        </div>
      </IonContent>
      <IonFooter className="ion-no-border">
        <div className="submit-bar">
          <IonButton expand="block" color="danger" onClick={submit} disabled={busy}>
            {busy ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={send} />{ready ? 'Send report' : 'Send report (finish steps 1 and 3)'}</>}
          </IonButton>
        </div>
      </IonFooter>
    </IonPage>
  );
}
