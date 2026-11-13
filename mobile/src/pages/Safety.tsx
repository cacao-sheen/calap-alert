import {
  IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonRefresher, IonRefresherContent,
  IonSelect, IonSelectOption, IonTitle, IonToggle, IonToolbar, useIonAlert, useIonRouter, useIonToast,
} from '@ionic/react';
import {
  businessOutline, chevronDown, chevronForward, handLeftOutline, informationCircleOutline, locationOutline,
  logOutOutline, peopleOutline, shieldCheckmark,
} from 'ionicons/icons';
import { useState, type CSSProperties } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import NotifBell from '../components/NotifBell';
import { isSharingLocation, sendMyLocation, stopSharingLocation } from '../components/LocationSharing';
import { usePageLoad } from '../hooks';
import { useNotifications } from '../notifications';
import type { DisasterEvent, EvacCenter, ResidentStatus, SafetyStatus } from '../types';
import { getLocation, STATUS_LABEL, timeAgo } from '../utils';

export default function Safety() {
  const { logout } = useAuth();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [confirm] = useIonAlert();
  const [event, setEvent] = useState<DisasterEvent | null>(null);
  const [mine, setMine] = useState<ResidentStatus | null>(null);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [centerId, setCenterId] = useState<number | null>(null);
  const [atCenterOpen, setAtCenterOpen] = useState(false);
  const [shareLocation, setShareLocation] = useState(isSharingLocation);
  const [busy, setBusy] = useState(false);
  const { requests } = useNotifications();

  async function load() {
    try {
      const [s, c] = await Promise.all([
        api<{ event: DisasterEvent | null; me: ResidentStatus | null }>('/checkins/me'),
        api<EvacCenter[]>('/evacuation-centers'),
      ]);
      setEvent(s.event);
      setMine(s.me);
      setCenters(c.filter((x) => x.isOpen));
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    }
  }
  usePageLoad(() => {
    load();
  });

  async function checkIn(status: Exclude<SafetyStatus, 'unaccounted'>) {
    if (status === 'evacuated' && !centerId) return toast({ message: 'Choose your evacuation center first', duration: 2000, color: 'warning' });
    setBusy(true);
    try {
      const loc = shareLocation ? await getLocation(true) : null;
      await api('/checkins', {
        method: 'POST',
        body: { status, evacuationCenterId: status === 'evacuated' ? centerId : null, lat: loc?.lat, lng: loc?.lng },
      });
      router.push(`/tabs/result/${status === 'need_help' ? 'help' : 'safe'}`);
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3500, color: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  // Asking for rescue sends a team, so make sure it wasn't a mis-tap
  const askHelp = () =>
    confirm({
      header: 'Ask for rescue?',
      message: 'Calapan CDRRMO will send a response team to your location.',
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Yes, I need help', handler: () => { checkIn('need_help'); } }],
    });

  const toggleShare = (v: boolean) => {
    setShareLocation(v);
    localStorage.setItem('shareLocation', String(v));
    if (v) sendMyLocation();
    else stopSharingLocation();
  };

  const myStatus = mine?.status ?? 'unaccounted';

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonTitle>My Safety</IonTitle>
          <NotifBell slot="end" />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">
          {event ? (
            <div className="alert-banner warning">
              <IonIcon icon={informationCircleOutline} />
              <div className="grow">
                <div className="kicker">{event.signalLevel ? `Signal No. ${event.signalLevel}` : 'Check-in is open'}</div>
                <b>{event.name}</b>
                <p>
                  Your status: <b style={{ display: 'inline' }}>{STATUS_LABEL[myStatus]}</b>
                  {mine?.checkedInAt ? ` · ${timeAgo(mine.checkedInAt)}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="alert-banner calm">
              <IonIcon icon={shieldCheckmark} />
              <div className="grow">
                <b>No check-in needed right now</b>
                <p>When your barangay starts a disaster check-in, you can tell them here if you are safe. You can ask for rescue any time.</p>
              </div>
            </div>
          )}

          <div className="section-title">How are you?</div>

          <button className="choice" style={{ '--c': '#16a34a' } as CSSProperties} disabled={busy || !event} onClick={() => checkIn('safe')}>
            <span className="chip-icon"><IonIcon icon={shieldCheckmark} /></span>
            <span className="grow"><b>I'm safe</b><span className="small">At home or in a safe place</span></span>
            <IonIcon icon={chevronForward} className="muted" />
          </button>

          <button className={`choice ${atCenterOpen ? 'open' : ''}`} style={{ '--c': '#2563eb' } as CSSProperties} disabled={busy || !event}
            onClick={() => setAtCenterOpen(!atCenterOpen)}>
            <span className="chip-icon"><IonIcon icon={businessOutline} /></span>
            <span className="grow"><b>I'm at an evacuation center</b><span className="small">Choose which center</span></span>
            <IonIcon icon={atCenterOpen ? chevronDown : chevronForward} className="muted" />
          </button>
          {atCenterOpen && event && (
            <div className="choice-extra" style={{ '--c': '#2563eb' } as CSSProperties}>
              <IonSelect label="Evacuation center" labelPlacement="floating" fill="outline" interface="action-sheet"
                value={centerId ?? undefined} onIonChange={(e) => setCenterId(Number(e.detail.value))}>
                {centers.map((c) => <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>)}
              </IonSelect>
              <IonButton expand="block" disabled={busy || !centerId} onClick={() => checkIn('evacuated')}>Check in here</IonButton>
            </div>
          )}

          <button className="choice" style={{ '--c': '#dc2626' } as CSSProperties} disabled={busy} onClick={askHelp}>
            <span className="chip-icon"><IonIcon icon={handLeftOutline} /></span>
            <span className="grow"><b>I need help</b><span className="small">Ask for rescue. A team will be sent.</span></span>
            <IonIcon icon={chevronForward} className="muted" />
          </button>

          <div className="section-title">Family members</div>
          <button className="choice" style={{ '--c': '#2563eb' } as CSSProperties} onClick={() => router.push('/tabs/family')}>
            <span className="chip-icon"><IonIcon icon={peopleOutline} /></span>
            <span className="grow">
              <b>Family members</b>
              <span className="small">
                {requests.received.length ? `${requests.received.length} new request${requests.received.length > 1 ? 's' : ''}` : 'See if your family and friends are safe'}
              </span>
            </span>
            {requests.received.length > 0 && <IonBadge color="danger">{requests.received.length}</IonBadge>}
            <IonIcon icon={chevronForward} className="muted" />
          </button>

          <div className="section-title">Settings</div>
          <div className="card settings" style={{ padding: '4px 16px' }}>
            <IonItem lines="full">
              <span slot="start" className="chip-icon" style={{ background: '#eff6ff', color: '#2563eb', width: 36, height: 36, fontSize: 18 }}><IonIcon icon={locationOutline} /></span>
              <IonToggle checked={shareLocation} onIonChange={(e) => toggleShare(e.detail.checked)} color="success">
                <IonLabel>
                  <b className="small">Share my location</b>
                  <p className="small muted">CDRRMO can see you on their live map</p>
                </IonLabel>
              </IonToggle>
            </IonItem>
            <IonItem lines="none" button detail={false} onClick={logout}>
              <span slot="start" className="chip-icon" style={{ background: '#fef2f2', color: '#dc2626', width: 36, height: 36, fontSize: 18 }}><IonIcon icon={logOutOutline} /></span>
              <IonLabel color="danger"><b className="small">Log out</b></IonLabel>
            </IonItem>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
