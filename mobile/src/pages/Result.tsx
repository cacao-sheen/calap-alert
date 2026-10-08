import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import { call, callOutline, carOutline, checkmark, homeOutline, locationOutline, mapOutline, timeOutline } from 'ionicons/icons';
import { useLocation, useParams } from 'react-router-dom';

const CONTENT = {
  safe: {
    color: '#16a34a',
    icon: checkmark,
    title: "You're marked safe!",
    message: 'Your barangay officials and your household can now see that you are safe.',
    rows: [
      [locationOutline, 'Your location was shared with responders (if enabled)'],
      [timeOutline, 'Your status stays active until the typhoon alert ends'],
    ],
  },
  help: {
    color: '#dc2626',
    icon: call,
    title: 'Help is on the way',
    message: 'Your request was sent to Calapan CDRRMO. Stay where you are, keep your phone on, and move to a higher place if water is rising.',
    rows: [
      [carOutline, 'A response team will be assigned to you'],
      [locationOutline, 'Your location was shared with responders (if enabled)'],
    ],
  },
  report: {
    color: '#1d4ed8',
    icon: checkmark,
    title: 'Report sent!',
    message: 'Calapan CDRRMO received your report.',
    rows: [
      [checkmark, 'Received by CDRRMO'],
      [timeOutline, 'An operator will verify your report'],
      [carOutline, 'A response team will be dispatched if needed'],
    ],
  },
} as const;

export default function Result() {
  const { kind } = useParams<{ kind: keyof typeof CONTENT }>();
  const code = new URLSearchParams(useLocation().search).get('code');
  const router = useIonRouter();
  const c = CONTENT[kind] ?? CONTENT.safe;

  return (
    <IonPage>
      <IonContent>
        <div className="result">
          <div className="result-icon" style={{ background: `${c.color}1f` }}>
            <div style={{ background: c.color }}><IonIcon icon={c.icon} /></div>
          </div>
          <h1>{c.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {c.message}{kind === 'report' && code ? ` Reference no. ${code}.` : ''}
          </p>
          <div className="details">
            {c.rows.map(([icon, text]) => (
              <div key={text} className="row"><IonIcon icon={icon} style={{ color: '#64748b' }} />{text}</div>
            ))}
          </div>
          {kind === 'help' && (
            <IonButton color="danger" size="large" href="tel:911"><IonIcon slot="start" icon={callOutline} />Call 911</IonButton>
          )}
          {kind === 'report' && (
            <IonButton size="large" onClick={() => router.push('/tabs/map')}><IonIcon slot="start" icon={mapOutline} />View on Map</IonButton>
          )}
          <IonButton size="large" fill={kind === 'safe' ? 'solid' : 'outline'} onClick={() => router.push('/tabs/home', 'root')}>
            <IonIcon slot="start" icon={homeOutline} />Back to Home
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
