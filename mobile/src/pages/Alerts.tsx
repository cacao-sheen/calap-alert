import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonRefresher,
  IonRefresherContent, IonSkeletonText, IonTitle, IonToolbar, useIonRouter,
} from '@ionic/react';
import { checkmarkCircleOutline, megaphoneOutline, navigateOutline, notificationsOffOutline, walkOutline } from 'ionicons/icons';
import { useState } from 'react';
import { api } from '../api';
import Empty from '../components/Empty';
import { usePageLoad } from '../hooks';
import type { Alert } from '../types';
import { timeAgo } from '../utils';

type Me = { barangayId: number };

// Remembers the newest alert the resident has seen, so Home can show a dot for new ones
export const SEEN_KEY = 'lastSeenAlertId';

function color(a: Alert) {
  if (a.endedAt) return '#64748b';
  return a.evacuate || a.level === 'danger' ? '#b91c1c' : a.level === 'warning' ? '#b45309' : '#1e40af';
}

export default function Alerts() {
  const router = useIonRouter();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const me = await api<Me>('/auth/me');
      const list = await api<Alert[]>(`/alerts?barangayId=${me.barangayId}&limit=50`);
      setAlerts(list);
      setError('');
      if (list[0]) localStorage.setItem(SEEN_KEY, String(list[0].id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  usePageLoad(() => {
    load();
  });

  const active = alerts?.filter((a) => !a.endedAt) ?? [];
  const past = alerts?.filter((a) => a.endedAt) ?? [];

  const card = (a: Alert) => (
    <div key={a.id} className="card notif" style={{ borderLeftColor: color(a) }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="chip-icon solid-icon" style={{ background: color(a) }}>
          <IonIcon icon={a.endedAt ? checkmarkCircleOutline : a.evacuate ? walkOutline : megaphoneOutline} />
        </span>
        <div className="grow">
          <div className="between">
            <span className="small muted">{a.barangay ? `Brgy. ${a.barangay}` : 'Both barangays'} · {timeAgo(a.createdAt)}</span>
            {a.endedAt ? <IonBadge color="medium">Ended</IonBadge> : a.evacuate && <IonBadge color="danger">Evacuate</IonBadge>}
          </div>
          <b>{a.title}</b>
          <p className="small" style={{ margin: '2px 0 0' }}>{a.message}</p>
          {a.endedAt && <p className="small muted" style={{ margin: '4px 0 0' }}>Ended {timeAgo(a.endedAt)}</p>}
        </div>
      </div>
      {a.evacuate && !a.endedAt && (
        <IonButton expand="block" color="danger" size="small" style={{ marginTop: 12 }} onClick={() => router.push('/tabs/map?live=1')}>
          <IonIcon slot="start" icon={navigateOutline} />Go to evacuation center
        </IonButton>
      )}
    </div>
  );

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/home" /></IonButtons>
          <IonTitle>Notifications<span className="header-sub">Alerts from your barangay and CDRRMO</span></IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">
          {error && <div className="error-card">{error}</div>}
          {alerts === null && !error && [0, 1, 2].map((i) => <div key={i} className="card"><IonSkeletonText animated style={{ height: 60 }} /></div>)}

          {active.length > 0 && <div className="section-title">Active now</div>}
          {active.map(card)}

          {past.length > 0 && <div className="section-title">Earlier</div>}
          {past.map(card)}

          {alerts?.length === 0 && (
            <Empty icon={notificationsOffOutline} title="No alerts yet" hint="When your barangay or CDRRMO sends an alert, it shows up here and on your phone." />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
