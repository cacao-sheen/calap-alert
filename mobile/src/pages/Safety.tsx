import {
  IonBadge, IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonRefresher, IonRefresherContent,
  IonSelect, IonSelectOption, IonTitle, IonToggle, IonToolbar, useIonAlert, useIonRouter, useIonToast,
} from '@ionic/react';
import {
  businessOutline, chevronDown, closeOutline, chevronForward, handLeftOutline, informationCircleOutline, locationOutline,
  logOutOutline, peopleOutline, personAddOutline, shieldCheckmark,
} from 'ionicons/icons';
import { useState, type CSSProperties } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import AddMemberModal from '../components/AddMemberModal';
import Empty from '../components/Empty';
import { usePageLoad } from '../hooks';
import type { DisasterEvent, EvacCenter, HouseholdInvite, ResidentStatus, SafetyStatus } from '../types';
import { getLocation, STATUS_COLOR, STATUS_LABEL, timeAgo, timeOf } from '../utils';

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#0e7490', '#b45309', '#334155', '#ea580c'];

export default function Safety() {
  const { logout } = useAuth();
  const router = useIonRouter();
  const [toast] = useIonToast();
  const [confirm] = useIonAlert();
  const [event, setEvent] = useState<DisasterEvent | null>(null);
  const [mine, setMine] = useState<ResidentStatus | null>(null);
  const [household, setHousehold] = useState<ResidentStatus[] | null>(null);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [centerId, setCenterId] = useState<number | null>(null);
  const [atCenterOpen, setAtCenterOpen] = useState(false);
  const [shareLocation, setShareLocation] = useState(() => localStorage.getItem('shareLocation') !== 'false');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [invites, setInvites] = useState<{ received: HouseholdInvite[]; sent: HouseholdInvite[] }>({ received: [], sent: [] });

  async function load() {
    try {
      const [s, h, c, inv] = await Promise.all([
        api<{ event: DisasterEvent | null; me: ResidentStatus | null }>('/checkins/me'),
        api<ResidentStatus[]>('/checkins/household'),
        api<EvacCenter[]>('/evacuation-centers'),
        // invites are extra; don't let them break the rest of the page
        api<{ received: HouseholdInvite[]; sent: HouseholdInvite[] }>('/household/invites').catch(() => ({ received: [], sent: [] })),
      ]);
      setEvent(s.event);
      setMine(s.me);
      setHousehold(h);
      setCenters(c.filter((x) => x.isOpen));
      setInvites(inv);
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

  // accept = join their household; otherwise decline (received) or cancel (sent)
  async function answerInvite(invite: HouseholdInvite, accept: boolean) {
    try {
      if (accept) await api(`/household/invites/${invite.id}/accept`, { method: 'POST' });
      else await api(`/household/invites/${invite.id}`, { method: 'DELETE' });
      toast({ message: accept ? `You joined ${invite.fromName}'s household` : 'Invite removed', duration: 2000, color: accept ? 'success' : 'medium' });
    } catch (e) {
      toast({ message: (e as Error).message, duration: 3000, color: 'danger' });
    }
    load();
  }

  const acceptInvite = (invite: HouseholdInvite) =>
    confirm({
      header: 'Join this household?',
      message: `You will be listed as ${invite.fromName}'s ${invite.relationship.toLowerCase()}. You will leave your current household.`,
      buttons: [{ text: 'Cancel', role: 'cancel' }, { text: 'Join', handler: () => { answerInvite(invite, true); } }],
    });

  const toggleShare = (v: boolean) => {
    setShareLocation(v);
    localStorage.setItem('shareLocation', String(v));
  };

  const myStatus = mine?.status ?? 'unaccounted';

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonTitle>My Safety</IonTitle>
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

          {invites.received.map((inv) => (
            <div key={inv.id} className="alert-banner info">
              <IonIcon icon={peopleOutline} />
              <div className="grow">
                <div className="kicker">Household invite</div>
                <b>{inv.fromName}</b>
                <p>wants to add you to their household as their {inv.relationship.toLowerCase()}.</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <IonButton size="small" onClick={() => acceptInvite(inv)}>Accept</IonButton>
                  <IonButton size="small" fill="outline" color="medium" onClick={() => answerInvite(inv, false)}>Decline</IonButton>
                </div>
              </div>
            </div>
          ))}

          <div className="between" style={{ marginBottom: -8 }}>
            <div className="section-title">My household</div>
            <IonButton size="small" fill="clear" onClick={() => setAddOpen(true)}><IonIcon slot="start" icon={personAddOutline} />Add</IonButton>
          </div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {household === null && <p className="small muted">Loading…</p>}
            {household?.length === 0 && <Empty icon={peopleOutline} title="No household members yet" hint="Tap Add to list the family members who live with you." />}
            {household?.map((m, i) => (
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
            {invites.sent.map((inv) => (
              <div key={`invite-${inv.id}`} className="row member">
                <span className="avatar" style={{ background: '#cbd5e1' }}>{inv.toName?.[0]}</span>
                <div className="grow">
                  <b className="small">{inv.toName}</b>
                  <div className="small muted">{inv.relationship} · Invite sent</div>
                </div>
                <IonBadge color="warning">Waiting</IonBadge>
                <IonButton size="small" fill="clear" color="medium" aria-label="Cancel invite" onClick={() => answerInvite(inv, false)}>
                  <IonIcon slot="icon-only" icon={closeOutline} />
                </IonButton>
              </div>
            ))}
          </div>

          <div className="section-title">Settings</div>
          <div className="card settings" style={{ padding: '4px 16px' }}>
            <IonItem lines="full">
              <span slot="start" className="chip-icon" style={{ background: '#eff6ff', color: '#2563eb', width: 36, height: 36, fontSize: 18 }}><IonIcon icon={locationOutline} /></span>
              <IonToggle checked={shareLocation} onIonChange={(e) => toggleShare(e.detail.checked)} color="success">
                <IonLabel>
                  <b className="small">Share my location</b>
                  <p className="small muted">Responders can see where you are</p>
                </IonLabel>
              </IonToggle>
            </IonItem>
            <IonItem lines="none" button detail={false} onClick={logout}>
              <span slot="start" className="chip-icon" style={{ background: '#fef2f2', color: '#dc2626', width: 36, height: 36, fontSize: 18 }}><IonIcon icon={logOutOutline} /></span>
              <IonLabel color="danger"><b className="small">Log out</b></IonLabel>
            </IonItem>
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
