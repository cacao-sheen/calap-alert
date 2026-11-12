import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent,
  IonSkeletonText, IonTitle, IonToolbar, useIonRouter, useIonToast,
} from '@ionic/react';
import { chevronForward, mailUnreadOutline, peopleOutline, personAddOutline } from 'ionicons/icons';
import { useState, type CSSProperties } from 'react';
import { api } from '../api';
import AddMemberModal from '../components/AddMemberModal';
import Empty from '../components/Empty';
import NotifBell from '../components/NotifBell';
import { usePageLoad } from '../hooks';
import { useNotifications } from '../notifications';
import type { ResidentStatus } from '../types';
import { STATUS_COLOR, STATUS_LABEL, timeOf } from '../utils';

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#0e7490', '#b45309', '#334155', '#ea580c'];

export default function Family() {
  const router = useIonRouter();
  const [toast] = useIonToast();
  const { requests, refresh } = useNotifications();
  const [members, setMembers] = useState<ResidentStatus[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    refresh();
    try {
      setMembers(await api<ResidentStatus[]>('/checkins/household'));
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    }
  }
  usePageLoad(() => {
    load();
  });

  const waiting = requests.received.length + requests.sent.length;

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/me" /></IonButtons>
          <IonTitle>Family members<span className="header-sub">Your family and friends</span></IonTitle>
          <NotifBell slot="end" />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">
          <button className="choice" style={{ '--c': '#2563eb' } as CSSProperties} onClick={() => router.push('/tabs/family/requests')}>
            <span className="chip-icon"><IonIcon icon={mailUnreadOutline} /></span>
            <span className="grow">
              <b>Requests</b>
              <span className="small">
                {requests.received.length
                  ? `${requests.received.length} waiting for your answer`
                  : waiting ? 'Invites you sent' : 'No requests right now'}
              </span>
            </span>
            {requests.received.length > 0 && <IonBadge color="danger">{requests.received.length}</IonBadge>}
            <IonIcon icon={chevronForward} className="muted" />
          </button>

          <div className="between" style={{ marginBottom: -8 }}>
            <div className="section-title">Family members</div>
            <IonButton size="small" fill="clear" onClick={() => setAddOpen(true)}><IonIcon slot="start" icon={personAddOutline} />Add</IonButton>
          </div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {members === null && <IonSkeletonText animated style={{ height: 48, margin: '12px 0' }} />}
            {members?.length === 1 && <Empty icon={peopleOutline} title="No family members yet" hint="Tap Add to add your family and friends." />}
            {members?.map((m, i) => (
              <div key={m.id} className="row member">
                <span className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{m.firstName[0]}{m.lastName[0]}</span>
                <div className="grow">
                  <b className="small">{m.firstName} {m.lastName}{i === 0 ? ' (You)' : ''}</b>
                  <div className="small muted">{[m.relationship, m.age != null && m.age >= 60 ? 'Senior' : null].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <IonBadge color={STATUS_COLOR[m.status]}>{STATUS_LABEL[m.status]}</IonBadge>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {m.checkedInAt ? timeOf(m.checkedInAt) : ''}{m.centerName ? ` · ${m.centerName}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <AddMemberModal isOpen={addOpen} onClose={() => setAddOpen(false)} onDone={(message) => {
          load();
          toast({ message, duration: 2500, color: 'success' });
        }} />
      </IonContent>
    </IonPage>
  );
}
