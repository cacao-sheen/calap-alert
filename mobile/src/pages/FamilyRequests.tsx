import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent,
  IonTitle, IonToolbar, useIonAlert, useIonToast,
} from '@ionic/react';
import { closeOutline, mailOpenOutline, peopleOutline } from 'ionicons/icons';
import { api } from '../api';
import Empty from '../components/Empty';
import NotifBell from '../components/NotifBell';
import { usePageLoad } from '../hooks';
import { useNotifications } from '../notifications';
import type { HouseholdInvite } from '../types';
import { RELATIONSHIPS, timeAgo } from '../utils';

export default function FamilyRequests() {
  const [toast] = useIonToast();
  const [ask] = useIonAlert();
  const { requests, refresh } = useNotifications();

  usePageLoad(() => {
    refresh();
  });

  // acceptAs = what the inviter is to me (accept); null = decline (received) or cancel (sent)
  async function answer(invite: HouseholdInvite, acceptAs: string | null) {
    try {
      if (acceptAs) await api(`/household/invites/${invite.id}/accept`, { method: 'POST', body: { relationship: acceptAs } });
      else await api(`/household/invites/${invite.id}`, { method: 'DELETE' });
      toast({
        message: acceptAs ? `${invite.fromName} is now in your Family members` : 'Request removed',
        duration: 2000,
        color: acceptAs ? 'success' : 'medium',
      });
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    }
    refresh();
  }

  const accept = (invite: HouseholdInvite) =>
    ask({
      header: `What is ${invite.fromName} to you?`,
      inputs: RELATIONSHIPS.map((r) => ({ type: 'radio' as const, label: r, value: r })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Accept',
          handler: (value?: string) => {
            if (!value) return false; // keep the box open until they pick one
            answer(invite, value);
          },
        },
      ],
    });

  const { received, sent } = requests;

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/family" /></IonButtons>
          <IonTitle>Requests<span className="header-sub">Family members invites</span></IonTitle>
          <NotifBell slot="end" />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { refresh(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page-pad">
          <div className="section-title">Received</div>
          {received.length === 0 && (
            <div className="card"><Empty icon={mailOpenOutline} title="No requests" hint="When someone adds you to their Family members, it shows up here." /></div>
          )}
          {received.map((inv) => (
            <div key={inv.id} className="alert-banner info">
              <IonIcon icon={peopleOutline} />
              <div className="grow">
                <div className="kicker">{timeAgo(inv.createdAt)}</div>
                <b>{inv.fromName}</b>
                <p>wants to add you to their Family members as their {inv.relationship.toLowerCase()}.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <IonButton size="small" onClick={() => accept(inv)}>Accept</IonButton>
                  <IonButton size="small" fill="outline" color="medium" onClick={() => answer(inv, null)}>Decline</IonButton>
                </div>
              </div>
            </div>
          ))}

          <div className="section-title">Sent</div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {sent.length === 0 && <p className="small muted">You have no invites waiting.</p>}
            {sent.map((inv) => (
              <div key={inv.id} className="row member">
                <span className="avatar" style={{ background: '#cbd5e1' }}>{inv.toName?.[0]}</span>
                <div className="grow">
                  <b className="small">{inv.toName}</b>
                  <div className="small muted">{inv.relationship} · sent {timeAgo(inv.createdAt)}</div>
                </div>
                <IonBadge color="warning">Waiting</IonBadge>
                <IonButton size="small" fill="clear" color="medium" aria-label="Cancel invite" onClick={() => answer(inv, null)}>
                  <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
              </div>
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
