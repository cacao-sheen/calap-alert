import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonInput, IonItem,
  IonLabel, IonList, IonSelect, IonSpinner, IonSelectOption, IonTextarea, IonToggle, useIonAlert, useIonRouter, useIonToast,
} from '@ionic/react';
import { checkmarkCircle, locationOutline, megaphoneOutline, rainyOutline, thunderstormOutline, walkOutline, warningOutline } from 'ionicons/icons';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import AdminPage from '../components/AdminPage';
import Empty from '../components/Empty';
import TypeIcon from '../components/TypeIcon';
import FormModal from '../components/FormModal';
import MapView from '../components/MapView';
import { usePageLoad } from '../hooks';
import type { Alert, BarangayStats, DisasterEvent, EvacCenter, Incident, Summary, Weather, WeatherEvent } from '../types';
import { centerState, fmt, INCIDENT_INFO, INCIDENT_STATUS, pct, placeName, timeOf, weatherText } from '../utils';

export default function Dashboard() {
  const router = useIonRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherEvent, setWeatherEvent] = useState<WeatherEvent | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'event' | 'alert' | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, inc, c] = await Promise.all([
        api<Summary>('/dashboard/summary'),
        api<Incident[]>('/incidents?status=active&limit=50'),
        api<EvacCenter[]>('/evacuation-centers'),
      ]);
      setSummary(s);
      setIncidents(inc);
      setCenters(c);
      setError('');
      api<Weather>('/weather').then(setWeather).catch(() => setWeather(null));
      api<WeatherEvent>('/weather/event').then(setWeatherEvent).catch(() => setWeatherEvent(null));
      api<Alert[]>('/alerts?active=1&limit=50').then(setAlerts).catch(() => setAlerts([]));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  usePageLoad(load);
  useEffect(() => {
    const t = setInterval(load, 30_000); // keep the dashboard live
    return () => clearInterval(t);
  }, [load]);

  const openIncident = useCallback((id: number) => router.push(`/incidents?id=${id}`), [router]);

  const actions = (
    <>
      <IonButton fill="solid" color="danger" onClick={() => setModal('alert')}>
        <IonIcon slot="start" icon={megaphoneOutline} />Send Alert
      </IonButton>
    </>
  );

  if (!summary) {
    return (
      <AdminPage title="Dashboard" actions={actions}>
        {error ? <p className="error">{error}</p> : <div className="loading"><IonSpinner name="crescent" /></div>}
      </AdminPage>
    );
  }
  const { totals, event } = summary;

  return (
    <AdminPage title="Dashboard" actions={actions}>
      <p className="muted subtitle">
        {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        {' · '}Brgy. Ibaba East &amp; Ibaba West, Calapan City
      </p>
      {error && <p className="error">{error}</p>}

      {/* Real typhoon / rain, fetched live; the admin's own alert for residents is shown underneath */}
      <div className={`banner ${weatherEvent?.kind === 'typhoon' ? '' : weatherEvent?.kind === 'rain' ? 'warn' : 'calm'}`}>
        <IonIcon icon={weatherEvent?.kind === 'none' || !weatherEvent ? checkmarkCircle : weatherEvent.kind === 'rain' ? rainyOutline : thunderstormOutline} className="banner-icon" />
        <div className="grow">
          {weatherEvent ? (
            <>
              <b>{weatherEvent.title}</b>
              <p>{weatherEvent.description}</p>
              <p className="banner-weather">
                Live from {weatherEvent.source}
                {weatherEvent.url && <> · <a href={weatherEvent.url} target="_blank" rel="noreferrer">Details</a></>}
              </p>
            </>
          ) : <p>Checking the weather…</p>}
          {event && <p className="banner-weather">Disaster check-in running: {event.signalLevel ? `Signal No. ${event.signalLevel} · ` : ''}{event.name} (started {timeOf(event.startedAt)}) — see Active alerts below to end it</p>}
        </div>
      </div>

      {(alerts.length > 0 || event) && <ActiveAlerts alerts={alerts} event={event} onEnded={load} />}

      <section className="kpis">
        <Kpi label="Total Residents" value={fmt(totals.residents)} sub={`${summary.barangays.length} barangays · ${fmt(totals.households)} households`} />
        <Kpi label="Marked Safe" value={fmt(totals.safe)} sub={`${pct(totals.safe, totals.residents)} of residents`} color="success" />
        <Kpi label="Unaccounted" value={fmt(totals.unaccounted)} sub={`${fmt(totals.needHelp)} need help right now`} color="danger"
          onClick={() => router.push('/residents?status=unaccounted')} />
        <Kpi label="Active Incidents" value={fmt(totals.activeIncidents)} color="warning" onClick={() => router.push('/incidents')}
          sub={summary.incidentsByType.slice(0, 3).map((t) => `${t.n} ${INCIDENT_INFO[t.type].label.toLowerCase()}`).join(' · ') || 'None'} />
        <Kpi label="Evacuees" value={fmt(summary.centers.occupancy)}
          sub={`${pct(summary.centers.occupancy, summary.centers.capacity)} of ${fmt(summary.centers.capacity)} capacity`} />
      </section>

      <div className="row-2">
        <IonCard className="panel grow">
          <IonCardHeader className="between">
            <IonCardTitle>Live Map<small className="section-hint">Tap a pin to see details. Tap an incident to open it.</small></IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <MapView centers={centers} incidents={incidents} height={360} onIncidentClick={openIncident} />
          </IonCardContent>
        </IonCard>
        <IonCard className="panel side wide">
          <IonCardHeader className="between">
            <IonCardTitle>Recent Incidents<small className="section-hint">Newest first</small></IonCardTitle>
            <IonButton fill="clear" size="small" routerLink="/incidents">View all →</IonButton>
          </IonCardHeader>
          <IonList lines="full">
            {incidents.slice(0, 6).map((i) => (
              <IonItem key={i.id} button detail={false} onClick={() => openIncident(i.id)}>
                <span slot="start"><TypeIcon type={i.type} /></span>
                <IonLabel>
                  <h3><b>{INCIDENT_INFO[i.type].label}</b> · {i.address ?? placeName(i.barangay)}</h3>
                  <p>{i.reporterName ?? 'Unknown'} · {timeOf(i.createdAt)}</p>
                </IonLabel>
                <IonBadge slot="end" color={INCIDENT_STATUS[i.status].color}>{INCIDENT_STATUS[i.status].label}</IonBadge>
              </IonItem>
            ))}
            {!incidents.length && <Empty icon={checkmarkCircle} title="No active incidents" hint="New reports from residents will show up here." />}
          </IonList>
        </IonCard>
      </div>

      <IonCard className="panel">
        <IonCardHeader className="between">
          <IonCardTitle>Barangay Status{event ? ` — ${event.name}` : ''}<small className="section-hint">How many residents are safe, evacuated or still unaccounted for</small></IonCardTitle>
          <small className="muted">{pct(totals.safe + totals.evacuated, totals.residents)} accounted for overall</small>
        </IonCardHeader>
        <IonCardContent className="two-col">
          {summary.barangays.map((b) => <BarangayBox key={b.id} b={b} />)}
        </IonCardContent>
      </IonCard>

      <div className="row-2">
        <IonCard className="panel side">
          <IonCardHeader className="between">
            <IonCardTitle>Weather · Calapan City</IonCardTitle>
            <IonBadge color="primary">{weather?.source ?? '—'}</IonBadge>
          </IonCardHeader>
          <IonCardContent>
            {weather ? (
              <div className="stack">
                <div className="row">
                  <span className="weather-icon"><IonIcon icon={rainyOutline} /></span>
                  <div>
                    <div className="temp">{Math.round(weather.temperature)}°C</div>
                    <div className="muted">{weatherText(weather.weatherCode)} · feels {Math.round(weather.feelsLike)}°</div>
                  </div>
                </div>
                <div className="grid-2">
                  <Stat label="Wind" value={`${Math.round(weather.windSpeed)} km/h`} />
                  <Stat label="Gusts" value={weather.windGusts != null ? `${Math.round(weather.windGusts)} km/h` : '—'} />
                  <Stat label="Rain now" value={`${weather.precipitation} mm`} />
                  <Stat label="Humidity" value={`${weather.humidity}%`} />
                </div>
                <div className="hourly">
                  {weather.hourly.filter((_, i) => i % 2 === 0).slice(0, 5).map((h) => (
                    <div key={h.time}>
                      <small>{new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}</small>
                      <b>{Math.round(h.temperature)}°</b>
                      <small>{h.rainChance != null ? `${h.rainChance}%` : weatherText(h.weatherCode)}</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="muted">Weather not available.</p>}
          </IonCardContent>
        </IonCard>
        <IonCard className="panel grow">
          <IonCardHeader className="between">
            <IonCardTitle>Evacuation Centers<small className="section-hint">How full each center is</small></IonCardTitle>
            <IonBadge color="success">{summary.centers.open} open</IonBadge>
          </IonCardHeader>
          <IonCardContent className="stack">
            {centers.map((c) => {
              const st = centerState(c);
              return (
                <div key={c.id} className="stack tight">
                  <div className="between"><b>{c.name}</b><span className="muted">{c.currentOccupancy}/{c.capacity}</span></div>
                  <Bar value={c.currentOccupancy / c.capacity} color={st.bar} />
                </div>
              );
            })}
            <div className="between total-line"><span className="muted">Total evacuees</span><b>{fmt(summary.centers.occupancy)} / {fmt(summary.centers.capacity)}</b></div>
          </IonCardContent>
        </IonCard>
      </div>

      <EventForm isOpen={modal === 'event'} event={event} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      <AlertForm isOpen={modal === 'alert'} barangays={summary.barangays} event={event} onClose={() => setModal(null)} onSaved={load} onManageEvent={() => setModal('event')} />
    </AdminPage>
  );
}

// Alerts residents can still see on their Home screen. Ending one removes it and tells their phones it's over.
function ActiveAlerts({ alerts, event, onEnded }: { alerts: Alert[]; event: DisasterEvent | null; onEnded: () => void }) {
  const [confirm] = useIonAlert();
  const [toast] = useIonToast();

  const end = (a: Alert) =>
    confirm({
      header: a.evacuate ? 'Lift this evacuation order?' : 'End this alert?',
      message: `"${a.title}" will be removed from residents' Home screen and they will get an "${a.evacuate ? 'All clear' : 'Alert ended'}" notification.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: a.evacuate ? 'Lift order' : 'End alert',
          role: 'destructive',
          handler: () => {
            api<{ push?: { sent: number; reason?: string } }>(`/alerts/${a.id}/end`, { method: 'POST' })
              .then((r) => {
                toast({ message: `Alert ended. ${r.push?.reason ?? `Notification sent to ${r.push?.sent ?? 0} phone(s).`}`, duration: 3500, color: 'success' });
                onEnded();
              })
              .catch((e) => toast({ message: e.message, duration: 3000, color: 'danger' }));
          },
        },
      ],
    });

  // The disaster check-in is separate from alerts: it is what asks residents "Are you safe?"
  const endCheckIn = () =>
    confirm({
      header: 'End the disaster check-in?',
      message: `Residents will no longer be asked if they are safe for "${event?.name}". Their answers are kept, and everyone starts as "not checked in" next time.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'End check-in',
          role: 'destructive',
          handler: () => {
            api('/events/active/end', { method: 'POST' })
              .then(() => { toast({ message: 'Disaster check-in ended', duration: 2500, color: 'success' }); onEnded(); })
              .catch((e) => toast({ message: e.message, duration: 3000, color: 'danger' }));
          },
        },
      ],
    });

  return (
    <IonCard className="panel">
      <IonCardHeader className="between">
        <IonCardTitle>Active alerts<small className="section-hint">Residents see these on their Home screen until you end them</small></IonCardTitle>
        <IonBadge color="danger">{alerts.length + (event ? 1 : 0)} active</IonBadge>
      </IonCardHeader>
      <IonList lines="full">
        {event && (
          <IonItem>
            <span slot="start" className="type-chip" style={{ background: '#b45309' }}><IonIcon icon={thunderstormOutline} /></span>
            <IonLabel className="ion-text-wrap">
              <h3><b>{event.name}</b><IonBadge color="warning" className="tag">Disaster check-in</IonBadge></h3>
              <p>{event.signalLevel ? `Signal No. ${event.signalLevel}. ` : ''}Residents are asked to tap "I'm safe", "Evacuated" or "I need help".</p>
              <p className="small">Started {timeOf(event.startedAt)}</p>
            </IonLabel>
            <IonButton slot="end" color="danger" fill="outline" size="small" onClick={endCheckIn}>End check-in</IonButton>
          </IonItem>
        )}
        {alerts.map((a) => (
          <IonItem key={a.id}>
            <span slot="start" className="type-chip" style={{ background: a.evacuate || a.level === 'danger' ? '#b91c1c' : a.level === 'warning' ? '#b45309' : '#1e40af' }}>
              <IonIcon icon={a.evacuate ? walkOutline : megaphoneOutline} />
            </span>
            <IonLabel className="ion-text-wrap">
              <h3><b>{a.title}</b>{a.evacuate && <IonBadge color="danger" className="tag">Evacuation order</IonBadge>}</h3>
              <p>{a.message}</p>
              <p className="small">{a.barangay ? `Brgy. ${a.barangay}` : 'Both barangays'} · sent {timeOf(a.createdAt)}</p>
            </IonLabel>
            <IonButton slot="end" color="danger" fill="outline" size="small" onClick={() => end(a)}>
              {a.evacuate ? 'Lift order' : 'End alert'}
            </IonButton>
          </IonItem>
        ))}
      </IonList>
    </IonCard>
  );
}

function Kpi({ label, value, sub, color, onClick }: { label: string; value: string; sub: string; color?: string; onClick?: () => void }) {
  return (
    <IonCard className={`kpi ${color ? `c-${color}` : ""}`} button={!!onClick} onClick={onClick}>
      <IonCardContent>
        <small className="muted">{label}</small>
        <div className="kpi-value">{value}</div>
        <small className={color ? `t-${color}` : 'muted'}>{sub}</small>
      </IonCardContent>
    </IonCard>
  );
}

function BarangayBox({ b }: { b: BarangayStats }) {
  return (
    <div className="brgy">
      <div className="between">
        <b className="row tight-row"><IonIcon icon={locationOutline} className="t-primary" />Brgy. {b.name}</b>
        <IonButton fill="clear" size="small" routerLink={`/residents?barangay=${b.id}`}>View residents →</IonButton>
      </div>
      <div className="mini-stats">
        <div><small>Residents</small><b>{fmt(b.total)}</b></div>
        <div><small>Safe</small><b className="t-success">{fmt(b.safe)}</b></div>
        <div><small>Evacuated</small><b className="t-primary">{fmt(b.evacuated)}</b></div>
        <div><small>Need help</small><b className="t-tertiary">{fmt(b.needHelp)}</b></div>
        <div><small>Unaccounted</small><b className="t-danger">{fmt(b.unaccounted)}</b></div>
      </div>
      <StackBar parts={[[b.safe, '#16a34a'], [b.evacuated, '#2563eb'], [b.needHelp, '#ea580c'], [b.unaccounted, '#dc2626']]} />
      {b.vulnerableAtRisk > 0 && <small className="t-danger"><IonIcon icon={warningOutline} className="meta-icon t-danger" /> {b.vulnerableAtRisk} seniors / PWD not yet safe</small>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><small>{label}</small><b>{value}</b></div>;
}

export function Bar({ value, color }: { value: number; color: string }) {
  return <div className="bar"><div style={{ width: `${Math.min(100, value * 100)}%`, background: color }} /></div>;
}

export function StackBar({ parts }: { parts: [number, string][] }) {
  const total = parts.reduce((a, [n]) => a + n, 0) || 1;
  return (
    <div className="stackbar">
      {parts.map(([n, color], i) => <div key={i} style={{ width: `${(n / total) * 100}%`, background: color }} />)}
    </div>
  );
}

function EventForm({ isOpen, event, onClose, onSaved }: { isOpen: boolean; event: DisasterEvent | null; onClose: () => void; onSaved: () => void }) {
  const [present] = useIonAlert();
  const [toast] = useIonToast();
  const [name, setName] = useState('');
  const [signal, setSignal] = useState('1');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(event?.name ?? 'Typhoon ');
    setSignal(event?.signalLevel != null ? String(event.signalLevel) : '1');
    setDescription(event?.description ?? '');
  }, [isOpen, event]);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/events/active', { method: 'PUT', body: { name, signalLevel: signal === 'none' ? null : Number(signal), description } });
      toast({ message: 'Disaster alert saved', duration: 2000, color: 'success' });
      onSaved();
    } catch (err) {
      toast({ message: (err as Error).message, duration: 3000, color: 'danger' });
    }
  }

  const end = () =>
    present({
      header: 'End this disaster alert?',
      message: 'Residents will need to check in again for the next one.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'End alert',
          role: 'destructive',
          handler: () => {
            api('/events/active/end', { method: 'POST' })
              .then(onSaved)
              .catch((err) => toast({ message: err.message, duration: 3000, color: 'danger' }));
          },
        },
      ],
    });

  return (
    <FormModal isOpen={isOpen} title={event ? 'Update disaster alert' : 'Start a disaster alert'} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <IonInput label="Name" labelPlacement="stacked" fill="outline" value={name} onIonInput={(e) => setName(e.detail.value ?? '')} required placeholder='e.g. Typhoon "Pepito"' />
        <IonSelect label="Typhoon signal level" labelPlacement="stacked" fill="outline" value={signal} onIonChange={(e) => setSignal(e.detail.value)}>
          <IonSelectOption value="none">None (not a typhoon)</IonSelectOption>
          {[1, 2, 3, 4, 5].map((n) => <IonSelectOption key={n} value={String(n)}>Signal No. {n}</IonSelectOption>)}
        </IonSelect>
        <IonTextarea label="Details shown to residents" labelPlacement="stacked" fill="outline" rows={4} value={description} onIonInput={(e) => setDescription(e.detail.value ?? '')} />
        <IonButton type="submit" expand="block">{event ? 'Save changes' : 'Start alert'}</IonButton>
        {event && <IonButton expand="block" fill="outline" color="medium" onClick={end}>End alert</IonButton>}
      </form>
    </FormModal>
  );
}

function AlertForm({ isOpen, barangays, event, onClose, onSaved, onManageEvent }: {
  isOpen: boolean; barangays: { id: number; name: string }[]; event: DisasterEvent | null;
  onClose: () => void; onSaved: () => void; onManageEvent: () => void;
}) {
  const [toast] = useIonToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState('warning');
  const [barangayId, setBarangayId] = useState('all');
  const [startEvent, setStartEvent] = useState(false);
  const [eventName, setEventName] = useState('Typhoon ');
  const [signal, setSignal] = useState('1');
  const [evacuate, setEvacuate] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    try {
      // A disaster in progress is what lets residents check in as safe / evacuated / need help
      if (startEvent && !event) {
        await api('/events/active', { method: 'PUT', body: { name: eventName, signalLevel: signal === 'none' ? null : Number(signal), description: message } });
      }
      const sent = await api<{ push?: { sent: number; reason?: string } }>('/alerts', {
        method: 'POST',
        body: { title, message, level: evacuate ? 'danger' : level, evacuate, barangayId: barangayId === 'all' ? null : Number(barangayId) },
      });
      const phones = sent.push?.reason ?? `Notification sent to ${sent.push?.sent ?? 0} phone(s).`;
      toast({ message: `${startEvent && !event ? 'Disaster started and alert posted' : 'Alert posted'}. ${phones}`, duration: 4000, color: sent.push?.reason ? 'warning' : 'success' });
      setTitle('');
      setMessage('');
      setStartEvent(false);
      setEvacuate(false);
      onSaved();
      onClose();
    } catch (err) {
      toast({ message: (err as Error).message, duration: 3000, color: 'danger' });
    }
  }

  return (
    <FormModal isOpen={isOpen} title="Send alert to residents" onClose={onClose}>
      <form className="stack" onSubmit={send}>
        <IonSelect label="Send to" labelPlacement="stacked" fill="outline" value={barangayId} onIonChange={(e) => setBarangayId(e.detail.value)}>
          <IonSelectOption value="all">Both barangays</IonSelectOption>
          {barangays.map((b) => <IonSelectOption key={b.id} value={String(b.id)}>Brgy. {b.name} only</IonSelectOption>)}
        </IonSelect>
        <div className={`confirm-card evac-toggle ${evacuate ? 'on' : ''}`}>
          <IonToggle checked={evacuate} onIonChange={(e) => setEvacuate(e.detail.checked)} color="danger">
            <b>Evacuation order</b>
          </IonToggle>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Residents get a phone notification even if the app is closed. Tapping it opens Live View, which guides them to the nearest open evacuation center.
          </p>
        </div>
        {!evacuate && (
        <IonSelect label="Level" labelPlacement="stacked" fill="outline" value={level} onIonChange={(e) => setLevel(e.detail.value)}>
          <IonSelectOption value="info">Info</IonSelectOption>
          <IonSelectOption value="warning">Warning</IonSelectOption>
          <IonSelectOption value="danger">Danger</IonSelectOption>
        </IonSelect>
        )}
        <IonInput label="Title" labelPlacement="stacked" fill="outline" value={title} onIonInput={(e) => setTitle(e.detail.value ?? '')} required placeholder={evacuate ? 'e.g. Go to the nearest evacuation center now' : 'e.g. Heavy rain this afternoon'} />
        <IonTextarea label="Message" labelPlacement="stacked" fill="outline" rows={4} value={message} onIonInput={(e) => setMessage(e.detail.value ?? '')} required />

        {event ? (
          <div className="confirm-card">
            <div className="confirm-place"><IonIcon icon={warningOutline} className="t-danger" /> Disaster in progress: {event.name}</div>
            <div className="muted small">Residents can check in as safe, evacuated or needing help.</div>
            <IonButton size="small" fill="clear" onClick={() => { onClose(); onManageEvent(); }}>Edit or end this disaster</IonButton>
          </div>
        ) : (
          <>
            <IonToggle checked={startEvent} onIonChange={(e) => setStartEvent(e.detail.checked)}>Also start a disaster check-in</IonToggle>
            {startEvent && (
              <>
                <p className="muted small">Residents will be asked to mark themselves safe, evacuated or needing help, and you will see who is unaccounted for.</p>
                <IonInput label="Disaster name" labelPlacement="stacked" fill="outline" value={eventName} onIonInput={(e) => setEventName(e.detail.value ?? '')} required placeholder='e.g. Typhoon "Pepito"' />
                <IonSelect label="Typhoon signal level" labelPlacement="stacked" fill="outline" value={signal} onIonChange={(e) => setSignal(e.detail.value)}>
                  <IonSelectOption value="none">None (not a typhoon)</IonSelectOption>
                  {[1, 2, 3, 4, 5].map((n) => <IonSelectOption key={n} value={String(n)}>Signal No. {n}</IonSelectOption>)}
                </IonSelect>
              </>
            )}
          </>
        )}

        <p className="muted small">Residents see it on the app's Home screen and get a notification on their phone.</p>
        <IonButton type="submit" expand="block" color="danger"><IonIcon slot="start" icon={megaphoneOutline} />{evacuate ? 'Send evacuation order' : 'Send alert'}</IonButton>
      </form>
    </FormModal>
  );
}
