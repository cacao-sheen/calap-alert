import {
  IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent,
  IonSelect, IonSelectOption, IonTitle, IonToggle, IonToolbar, useIonRouter, useIonToast,
} from '@ionic/react';
import { businessOutline, callOutline, locationOutline, logOutOutline, shieldCheckmark, warningOutline } from 'ionicons/icons';
import { useState } from 'react';
import { api } from '../api';
import { usePageLoad } from '../hooks';
import { useAuth } from '../auth';
import type { DisasterEvent, EvacCenter, ResidentStatus, SafetyStatus } from '../types';
import { getLocation, STATUS_COLOR, STATUS_LABEL, timeOf } from '../utils';

const AVATAR_COLORS = ['#1d4ed8', '#16a34a', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c'];

export default function Safety() {
  const { logout } = useAuth();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [event, setEvent] = useState<DisasterEvent | null>(null);
  const [household, setHousehold] = useState<ResidentStatus[]>([]);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [centerId, setCenterId] = useState<number | null>(null);
  const [shareLocation, setShareLocation] = useState(() => localStorage.getItem('shareLocation') !== 'false');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [s, h, c] = await Promise.all([
        api<{ event: DisasterEvent | null }>('/checkins/me'),
        api<ResidentStatus[]>('/checkins/household'),
        api<EvacCenter[]>('/evacuation-centers'),
      ]);
      setEvent(s.event);
      setHousehold(h);
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
      const loc = shareLocation ? await getLocation() : null;
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

  const toggleShare = (v: boolean) => {
    setShareLocation(v);
    localStorage.setItem('shareLocation', String(v));
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Safety Check-in</IonTitle>
          <IonButton slot="end" fill="clear" color="medium" onClick={logout}><IonIcon icon={logOutOutline} /></IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">
          <div className="card row" style={{ background: event ? '#fef3c7' : '#f1f5f9', boxShadow: 'none', padding: 12 }}>
            <IonIcon icon={warningOutline} style={{ color: '#b45309', fontSize: 18 }} />
            <span className="small" style={{ fontWeight: 600, color: '#92400e' }}>
              {event
                ? `${event.name}${event.signalLevel ? ` · Signal No. ${event.signalLevel}` : ''} is active. Please check in.`
                : 'No active disaster alert right now.'}
            </span>
          </div>

          <div className="safe-ring">
            <div>
              <button className="safe-button" disabled={busy || !event} onClick={() => checkIn('safe')}>
                <IonIcon icon={shieldCheckmark} style={{ fontSize: 40 }} />
                I'M SAFE
              </button>
            </div>
          </div>
          <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
            Tap to tell your barangay and your family that you are safe.
          </p>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b className="small">I'm at an evacuation center</b>
            <IonSelect label="Evacuation center" labelPlacement="floating" fill="outline" interface="action-sheet"
              value={centerId ?? undefined} onIonChange={(e) => setCenterId(Number(e.detail.value))}>
              {centers.map((c) => <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>)}
            </IonSelect>
            <IonButton expand="block" fill="outline" disabled={busy || !event} onClick={() => checkIn('evacuated')}>
              <IonIcon slot="start" icon={businessOutline} />Check in at this center
            </IonButton>
          </div>

          <IonButton expand="block" color="danger" fill="outline" size="large" disabled={busy || !event} onClick={() => checkIn('need_help')}>
            <IonIcon slot="start" icon={callOutline} />I Need Help / Rescue
          </IonButton>

          <div className="card row" style={{ padding: 14 }}>
            <span className="chip-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}><IonIcon icon={locationOutline} /></span>
            <div className="grow">
              <b className="small">Share my location</b>
              <div className="small muted">Responders can see where you are</div>
            </div>
            <IonToggle checked={shareLocation} onIonChange={(e) => toggleShare(e.detail.checked)} color="success" />
          </div>

          <div className="section-title">My Household</div>
          <div className="card" style={{ padding: '4px 14px' }}>
            {household.map((m, i) => (
              <div key={m.id} className="row" style={{ padding: '10px 0', borderBottom: i < household.length - 1 ? '1px solid #f1f5f9' : 0 }}>
                <span className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{m.firstName[0]}{m.lastName[0]}</span>
                <div className="grow">
                  <b className="small">{m.firstName} {m.lastName}{i === 0 ? ' (You)' : ''}</b>
                  <div className="small muted">{[m.relationship, m.age != null && m.age >= 60 ? 'Senior' : null].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <IonBadge color={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status]}</IonBadge>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {m.checkedInAt ? timeOf(m.checkedInAt) : '—'}{m.centerName ? ` · ${m.centerName}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
