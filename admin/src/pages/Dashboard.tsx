import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonInput, IonItem,
  IonLabel, IonList, IonSelect, IonSelectOption, IonTextarea, useIonAlert, useIonRouter, useIonToast,
} from '@ionic/react';
import { alertCircle, checkmarkCircle, megaphoneOutline, rainyOutline, thunderstormOutline } from 'ionicons/icons';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import AdminPage from '../components/AdminPage';
import FormModal from '../components/FormModal';
import MapView from '../components/MapView';
import { usePageLoad } from '../hooks';
import type { BarangayStats, DisasterEvent, EvacCenter, Incident, Summary, Weather } from '../types';
import { centerState, fmt, INCIDENT_INFO, INCIDENT_STATUS, pct, timeOf, weatherHeadline, weatherText } from '../utils';

export default function Dashboard() {
  const router = useIonRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'event' | 'alert' | null>(null);

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
      <IonButton fill="outline" onClick={() => setModal('event')}>
        <IonIcon slot="start" icon={thunderstormOutline} />{summary?.event ? 'Update Typhoon Alert' : 'Start Disaster Alert'}
      </IonButton>
      <IonButton fill="solid" color="danger" onClick={() => setModal('alert')}>
        <IonIcon slot="start" icon={megaphoneOutline} />Send Alert
      </IonButton>
    </>
  );

  if (!summary) {
    return (
      <AdminPage title="Dashboard" actions={actions}>
        {error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}
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

      {event ? (
        <div className="banner">
          <IonIcon icon={alertCircle} className="banner-icon" />
          <div className="grow">
            <b>{event.signalLevel ? `Typhoon Signal No. ${event.signalLevel} · ` : ''}{event.name}</b>
            <p>{event.description}</p>
            {weather && <p className="banner-weather">Live now: {weatherHeadline(weather)}</p>}
          </div>
          <small className="muted">Started {timeOf(event.startedAt)}</small>
        </div>
      ) : (
        <div className="banner calm">
          <IonIcon icon={checkmarkCircle} className="banner-icon" />
          <div className="grow">
            <b>No active disaster alert</b>
            <p>Start a disaster alert so residents can check in as safe, evacuated or needing help.</p>
            {weather && <p className="banner-weather">Live now: {weatherHeadline(weather)}</p>}
          </div>
        </div>
      )}

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

      <IonCard className="panel">
        <IonCardHeader className="between">
          <IonCardTitle>Barangay Status{event ? ` — ${event.name}` : ''}</IonCardTitle>
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
                  <Stat label="Gusts" value={`${Math.round(weather.windGusts)} km/h`} />
                  <Stat label="Rain now" value={`${weather.precipitation} mm`} />
                  <Stat label="Humidity" value={`${weather.humidity}%`} />
                </div>
                <div className="hourly">
                  {weather.hourly.filter((_, i) => i % 2 === 0).slice(0, 5).map((h) => (
                    <div key={h.time}>
                      <small>{new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}</small>
                      <b>{Math.round(h.temperature)}°</b>
                      <small>{h.rainChance}%</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="muted">Weather not available.</p>}
          </IonCardContent>
        </IonCard>
        <IonCard className="panel grow">
          <IonCardHeader className="between">
            <IonCardTitle>Live Map · Ibaba East &amp; Ibaba West</IonCardTitle>
            <small className="muted">Click an incident to open it</small>
          </IonCardHeader>
          <IonCardContent>
            <MapView centers={centers} incidents={incidents} height={330} onIncidentClick={openIncident} />
          </IonCardContent>
        </IonCard>
      </div>

      <div className="row-2">
        <IonCard className="panel grow">
          <IonCardHeader className="between">
            <IonCardTitle>Recent Incident Reports</IonCardTitle>
            <IonButton fill="clear" size="small" routerLink="/incidents">View all →</IonButton>
          </IonCardHeader>
          <IonList lines="full">
            {incidents.slice(0, 6).map((i) => (
              <IonItem key={i.id} button detail={false} onClick={() => openIncident(i.id)}>
                <span slot="start" className="type-chip" style={{ background: INCIDENT_INFO[i.type].bg }}>{INCIDENT_INFO[i.type].emoji}</span>
                <IonLabel>
                  <h3><b>{INCIDENT_INFO[i.type].label}</b> · {i.address ?? `Brgy. ${i.barangay ?? '—'}`}</h3>
                  <p>{i.reporterName ?? 'Unknown'} · {timeOf(i.createdAt)}</p>
                </IonLabel>
                <IonBadge slot="end" color={INCIDENT_STATUS[i.status].color}>{INCIDENT_STATUS[i.status].label}</IonBadge>
              </IonItem>
            ))}
            {!incidents.length && <IonItem><IonLabel className="muted">No active incidents.</IonLabel></IonItem>}
          </IonList>
        </IonCard>
        <IonCard className="panel side">
          <IonCardHeader className="between">
            <IonCardTitle>Evacuation Centers</IonCardTitle>
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
      <AlertForm isOpen={modal === 'alert'} barangays={summary.barangays} onClose={() => setModal(null)} />
    </AdminPage>
  );
}

function Kpi({ label, value, sub, color, onClick }: { label: string; value: string; sub: string; color?: string; onClick?: () => void }) {
  return (
    <IonCard className="kpi" button={!!onClick} onClick={onClick}>
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
        <b>📍 Brgy. {b.name}</b>
        <IonButton fill="clear" size="small" routerLink={`/residents?barangay=${b.id}`}>View residents →</IonButton>
      </div>
      <div className="mini-stats">
        <div><small>Residents</small><b>{fmt(b.total)}</b></div>
        <div><small>Safe</small><b className="t-success">{fmt(b.safe)}</b></div>
        <div><small>Evacuated</small><b className="t-primary">{fmt(b.evacuated)}</b></div>
        <div><small>Need help</small><b className="t-tertiary">{fmt(b.needHelp)}</b></div>
        <div><small>Unaccounted</small><b className="t-danger">{fmt(b.unaccounted)}</b></div>
      </div>
      <StackBar parts={[[b.safe, '#16a34a'], [b.evacuated, '#2563eb'], [b.needHelp, '#9333ea'], [b.unaccounted, '#dc2626']]} />
      {b.vulnerableAtRisk > 0 && <small className="t-danger">⚠ {b.vulnerableAtRisk} seniors / PWD not yet safe</small>}
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
        <IonInput label="Name" labelPlacement="stacked" fill="outline" value={name} onIonInput={(e) => setName(e.detail.value ?? '')} required placeholder='e.g. Typhoon "Kiko"' />
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

function AlertForm({ isOpen, barangays, onClose }: { isOpen: boolean; barangays: { id: number; name: string }[]; onClose: () => void }) {
  const [toast] = useIonToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState('warning');
  const [barangayId, setBarangayId] = useState('all');

  async function send(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/alerts', { method: 'POST', body: { title, message, level, barangayId: barangayId === 'all' ? null : Number(barangayId) } });
      toast({ message: 'Alert sent to residents', duration: 2000, color: 'success' });
      setTitle('');
      setMessage('');
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
        <IonSelect label="Level" labelPlacement="stacked" fill="outline" value={level} onIonChange={(e) => setLevel(e.detail.value)}>
          <IonSelectOption value="info">Info</IonSelectOption>
          <IonSelectOption value="warning">Warning</IonSelectOption>
          <IonSelectOption value="danger">Danger</IonSelectOption>
        </IonSelect>
        <IonInput label="Title" labelPlacement="stacked" fill="outline" value={title} onIonInput={(e) => setTitle(e.detail.value ?? '')} required placeholder="e.g. Pre-emptive evacuation" />
        <IonTextarea label="Message" labelPlacement="stacked" fill="outline" rows={4} value={message} onIonInput={(e) => setMessage(e.detail.value ?? '')} required />
        <p className="muted small">Residents see this on the Calap Alert app's Home screen.</p>
        <IonButton type="submit" expand="block" color="danger"><IonIcon slot="start" icon={megaphoneOutline} />Send alert</IonButton>
      </form>
    </FormModal>
  );
}
