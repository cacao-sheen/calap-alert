import {
  IonButton, IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSkeletonText,
  useIonRouter,
} from '@ionic/react';
import {
  alertCircle, businessOutline, callOutline, checkmark, cloudOutline, layersOutline, locationOutline,
  rainyOutline, shieldCheckmarkOutline, speedometerOutline, warningOutline, waterOutline,
} from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { usePageLoad } from '../hooks';
import type { Alert, DisasterEvent, ResidentStatus, Weather } from '../types';
import { STATUS_LABEL, timeAgo, weatherHeadline, weatherText } from '../utils';

type Me = { firstName: string; barangay: string; barangayId: number };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Magandang umaga' : h < 18 ? 'Magandang hapon' : 'Magandang gabi';
}

export default function Home() {
  const router = useIonRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [event, setEvent] = useState<DisasterEvent | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [status, setStatus] = useState<ResidentStatus | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const profile = await api<Me>('/auth/me');
      setMe(profile);
      const [w, s, alerts] = await Promise.all([
        api<Weather>('/weather').catch(() => null),
        api<{ event: DisasterEvent | null; me: ResidentStatus | null }>('/checkins/me'),
        api<Alert[]>(`/alerts?barangayId=${profile.barangayId}`),
      ]);
      setWeather(w);
      setEvent(s.event);
      setStatus(s.me);
      setAlert(alerts[0] ?? null);
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
  const level = event?.signalLevel ? 'danger' : alert?.level ?? 'info';

  return (
    <IonPage>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => load().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="hero">
          <h1>{greeting()}{me ? `, ${me.firstName}!` : '!'}</h1>
          <div className="sub"><IonIcon icon={locationOutline} /> Brgy. {me?.barangay ?? '…'}, Calapan City</div>
        </div>

        <div className="page-pad">
          {error && <div className="card" style={{ color: '#b91c1c' }}>{error}</div>}

          {(event || alert) && (
            <div className={`alert-banner ${level}`} onClick={() => go('/tabs/evac')}>
              <div className="chip-icon" style={{ background: '#fff', color: '#dc2626' }}><IonIcon icon={alertCircle} /></div>
              <div className="grow">
                <div className="kicker">
                  {event?.signalLevel ? `TYPHOON SIGNAL NO. ${event.signalLevel}` : alert?.title.toUpperCase()}
                </div>
                <p>{event ? `${event.name}. ${event.description ?? ''}` : alert?.message}</p>
                {weather && <p style={{ fontWeight: 600, marginTop: 6 }}>Live now: {weatherHeadline(weather)}</p>}
                {alert && event &&<p className="small" style={{ opacity: 0.85 }}>Latest: {alert.title} · {timeAgo(alert.createdAt)}</p>}
              </div>
            </div>
          )}

          <div className="card">
            <div className="between">
              <div>
                <div className="small muted" style={{ fontWeight: 600 }}>Weather Update · Calapan City</div>
                {weather ? (
                  <>
                    <div className="big-temp">{Math.round(weather.temperature)}°C</div>
                    <div>{weatherText(weather.weatherCode)} · Feels like {Math.round(weather.feelsLike)}°</div>
                  </>
                ) : (
                  <IonSkeletonText animated style={{ width: 160, height: 60 }} />
                )}
              </div>
              <div className="chip-icon" style={{ width: 72, height: 72, background: '#dbeafe', color: '#1d4ed8', fontSize: 40 }}>
                <IonIcon icon={weather && weather.weatherCode >= 51 ? rainyOutline : cloudOutline} />
              </div>
            </div>
            {weather && (
              <>
                <div className="stats" style={{ marginTop: 14 }}>
                  <div className="stat"><div className="label"><IonIcon icon={speedometerOutline} /> Wind</div><div className="value">{Math.round(weather.windSpeed)} km/h</div></div>
                  <div className="stat"><div className="label"><IonIcon icon={rainyOutline} /> Rain chance</div><div className="value">{weather.rainChance ?? 0}%</div></div>
                  <div className="stat"><div className="label"><IonIcon icon={waterOutline} /> Gusts</div><div className="value" style={{ color: weather.windGusts > 60 ? '#dc2626' : undefined }}>{Math.round(weather.windGusts)} km/h</div></div>
                </div>
                <div className="hourly" style={{ marginTop: 12 }}>
                  {weather.hourly.filter((_, i) => i % 3 === 0).slice(0, 4).map((h) => (
                    <div key={h.time}>
                      <span className="muted">{new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}</span>
                      <b>{Math.round(h.temperature)}°</b>
                      <span className="muted">{h.rainChance}%</span>
                    </div>
                  ))}
                </div>
                <div className="small muted" style={{ marginTop: 10 }}>Source: {weather.source} · Updated {new Date(weather.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
              </>
            )}
          </div>

          <div className="card">
            <div className="row">
              <div className="chip-icon" style={{ width: 36, height: 36, background: '#dcfce7', color: '#16a34a', fontSize: 18 }}><IonIcon icon={shieldCheckmarkOutline} /></div>
              <div className="grow">
                <b>Are you safe?</b>
                <div className="small muted">
                  {status && status.status !== 'unaccounted'
                    ? `Your status: ${STATUS_LABEL[status.status]}${status.checkedInAt ? ` · ${timeAgo(status.checkedInAt)}` : ''}`
                    : 'Let your barangay know your status'}
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <IonButton className="grow" color="success" onClick={() => go('/tabs/me')}><IonIcon slot="start" icon={checkmark} />I'm Safe</IonButton>
              <IonButton className="grow" color="danger" fill="outline" onClick={() => go('/tabs/me')}><IonIcon slot="start" icon={callOutline} />I Need Help</IonButton>
            </div>
          </div>

          <div className="section-title">Quick Actions</div>
          <div className="quick">
            <button onClick={() => go('/tabs/report')}><span className="chip-icon" style={{ width: 44, height: 44, background: '#fee2e2', color: '#dc2626' }}><IonIcon icon={warningOutline} /></span>Report</button>
            <button onClick={() => go('/tabs/evac')}><span className="chip-icon" style={{ width: 44, height: 44, background: '#dcfce7', color: '#16a34a' }}><IonIcon icon={businessOutline} /></span>Evac Centers</button>
            <button onClick={() => go('/tabs/map')}><span className="chip-icon" style={{ width: 44, height: 44, background: '#dbeafe', color: '#1d4ed8' }}><IonIcon icon={layersOutline} /></span>3D Map</button>
            <button onClick={() => (window.location.href = 'tel:911')}><span className="chip-icon" style={{ width: 44, height: 44, background: '#fef3c7', color: '#d97706' }}><IonIcon icon={callOutline} /></span>Call 911</button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
