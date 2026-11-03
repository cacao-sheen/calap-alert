import {
  IonButton, IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSkeletonText,
  useIonRouter,
} from '@ionic/react';
import {
  businessOutline, callOutline, navigateOutline, notificationsOutline, checkmarkCircle, cloudOutline, handLeftOutline, mapOutline, megaphone,
  rainyOutline, shieldCheckmark, speedometerOutline, thunderstorm, warningOutline, waterOutline,
} from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { api } from '../api';
import LogoMark from '../components/LogoMark';
import { SEEN_KEY } from './Alerts';
import { usePageLoad } from '../hooks';
import type { Alert, DisasterEvent, ResidentStatus, Weather, WeatherEvent } from '../types';
import { STATUS_LABEL, timeAgo, weatherText } from '../utils';

type Me = { firstName: string; barangay: string; barangayId: number };

const STATUS_DOT: Record<string, string> = { safe: '#4ade80', evacuated: '#93c5fd', need_help: '#f87171', unaccounted: '#cbd5e1' };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Magandang umaga' : h < 18 ? 'Magandang hapon' : 'Magandang gabi';
}

export default function Home() {
  const router = useIonRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [live, setLive] = useState<WeatherEvent | null>(null);
  const [event, setEvent] = useState<DisasterEvent | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [status, setStatus] = useState<ResidentStatus | null>(null);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(false);

  async function load() {
    setError('');
    try {
      const profile = await api<Me>('/auth/me');
      setMe(profile);
      // Weather can be slow; load it on its own so alerts never wait for it
      api<Weather>('/weather').then(setWeather).catch(() => setWeather(null));
      api<WeatherEvent>('/weather/event').then(setLive).catch(() => setLive(null));
      const [s, alerts] = await Promise.all([
        api<{ event: DisasterEvent | null; me: ResidentStatus | null }>('/checkins/me'),
        api<Alert[]>(`/alerts?barangayId=${profile.barangayId}&active=1`),
      ]);
      setEvent(s.event);
      setStatus(s.me);
      setAlert(alerts[0] ?? null);
      setUnread(!!alerts[0] && alerts[0].id > Number(localStorage.getItem(SEEN_KEY) ?? 0));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  usePageLoad(() => {
    load();
  });
  // Refresh alerts and weather every minute while the app is open
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const go = (path: string) => router.push(path);
  const myStatus = status?.status ?? 'unaccounted';
  const alertLevel = event?.signalLevel || alert?.evacuate ? 'danger' : alert?.level ?? 'info';

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="hero">
          <div className="hero-brand">
            <span className="logo-tile"><LogoMark size={26} /></span>
            <span className="grow">Calap Alert</span>
            <button className="bell" onClick={() => go('/tabs/alerts')} aria-label="Notifications">
              <IonIcon icon={notificationsOutline} />
              {unread && <i />}
            </button>
          </div>
          <h1>{greeting()}{me ? `, ${me.firstName}!` : '!'}</h1>
          <div className="sub">
            {me ? `Brgy. ${me.barangay}, Calapan City` : <IonSkeletonText animated style={{ width: 170, height: 14 }} />}
          </div>
          {event && (
            <div className="status-pill">
              <i style={{ background: STATUS_DOT[myStatus] }} />
              Your status: {STATUS_LABEL[myStatus]}
            </div>
          )}
        </div>

        <div className="page-pad overlap">
          {error && <div className="error-card">{error}</div>}

          {/* Message from the barangay / CDRRMO */}
          {(event || alert) && (
            <div className={`alert-banner ${alertLevel}`} onClick={() => go(alert ? '/tabs/alerts' : '/tabs/evac')}>
              <IonIcon icon={megaphone} />
              <div className="grow">
                <div className="kicker">{alert?.evacuate ? 'Evacuation order' : event?.signalLevel ? `Typhoon Signal No. ${event.signalLevel}` : 'Barangay alert'}</div>
                <b>{alert?.evacuate || !event ? alert?.title : event.name}</b>
                <p>{alert?.evacuate || !event ? alert?.message : event.description}</p>
                {alert && event && !alert.evacuate && <p className="small">Latest: {alert.title} · {timeAgo(alert.createdAt)}</p>}
                {alert?.evacuate && (
                  <IonButton color="danger" size="small" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); go('/tabs/map?live=1'); }}>
                    <IonIcon slot="start" icon={navigateOutline} />Go to evacuation center
                  </IonButton>
                )}
              </div>
            </div>
          )}

          {/* Real typhoon / rain right now */}
          {live && (
            <div className={`alert-banner ${live.kind === 'typhoon' ? 'danger' : live.kind === 'rain' ? 'warning' : 'calm'}`}>
              <IonIcon icon={live.kind === 'typhoon' ? thunderstorm : live.kind === 'rain' ? rainyOutline : checkmarkCircle} />
              <div className="grow">
                <div className="kicker">Live weather</div>
                <b>{live.title}</b>
                <p>{live.description}</p>
              </div>
            </div>
          )}

          <div className="card safety-card">
            <div className="row">
              <span className="chip-icon solid-icon" style={{ background: '#16a34a' }}><IonIcon icon={shieldCheckmark} /></span>
              <div className="grow">
                <b>Are you safe?</b>
                <div className="small muted">
                  {!event
                    ? 'No check-in needed right now. We will tell you when to check in.'
                    : myStatus !== 'unaccounted'
                      ? `You checked in as ${STATUS_LABEL[myStatus]}${status?.checkedInAt ? ` · ${timeAgo(status.checkedInAt)}` : ''}`
                      : 'Your barangay is asking everyone to check in.'}
                </div>
              </div>
            </div>
            {event && (
              <div className="actions">
                <IonButton color="success" onClick={() => go('/tabs/me')}>I'm safe</IonButton>
                <IonButton color="danger" fill="outline" onClick={() => go('/tabs/me')}><IonIcon slot="start" icon={handLeftOutline} />I need help</IonButton>
              </div>
            )}
          </div>

          <div className="card">
            <div className="between">
              <div>
                <div className="small muted">Weather · Calapan City</div>
                {weather ? (
                  <>
                    <div className="big-temp">{Math.round(weather.temperature)}°C</div>
                    <div className="small">{weatherText(weather.weatherCode)} · Feels like {Math.round(weather.feelsLike)}°</div>
                  </>
                ) : (
                  <IonSkeletonText animated style={{ width: 150, height: 52 }} />
                )}
              </div>
              <div className="weather-tile">
                <IonIcon icon={weather && weather.weatherCode >= 51 ? rainyOutline : cloudOutline} />
              </div>
            </div>
            {weather && (
              <>
                <div className="stats" style={{ margin: '14px 0 12px' }}>
                  <div className="stat"><div className="label"><IonIcon icon={speedometerOutline} />Wind</div><div className="value">{Math.round(weather.windSpeed)} km/h</div></div>
                  <div className="stat"><div className="label"><IonIcon icon={rainyOutline} />Rain</div><div className="value">{weather.rainChance != null ? `${weather.rainChance}%` : '—'}</div></div>
                  <div className="stat"><div className="label"><IonIcon icon={waterOutline} />Gusts</div><div className="value" style={{ color: (weather.windGusts ?? 0) > 60 ? '#dc2626' : undefined }}>{weather.windGusts != null ? `${Math.round(weather.windGusts)} km/h` : '—'}</div></div>
                </div>
                <div className="hourly">
                  {weather.hourly.filter((_, i) => i % 3 === 0).slice(0, 4).map((h) => (
                    <div key={h.time}>
                      <span className="muted">{new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}</span>
                      <b>{Math.round(h.temperature)}°</b>
                      <span className="muted">{h.rainChance != null ? `${h.rainChance}%` : weatherText(h.weatherCode)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="section-title">Quick actions</div>
          <div className="quick">
            <button onClick={() => go('/tabs/report')}><span className="chip-icon solid-icon" style={{ background: '#dc2626' }}><IonIcon icon={warningOutline} /></span>Report</button>
            <button onClick={() => go('/tabs/evac')}><span className="chip-icon solid-icon" style={{ background: '#16a34a' }}><IonIcon icon={businessOutline} /></span>Evac centers</button>
            <button onClick={() => go('/tabs/map')}><span className="chip-icon solid-icon" style={{ background: '#2563eb' }}><IonIcon icon={mapOutline} /></span>Map</button>
            <button onClick={() => (window.location.href = 'tel:911')}><span className="chip-icon solid-icon" style={{ background: '#d97706' }}><IonIcon icon={callOutline} /></span>Call 911</button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
