import { IonIcon, useIonRouter } from '@ionic/react';
import { notificationsOutline } from 'ionicons/icons';
import { useNotifications } from '../notifications';

// The bell in every page's header. The red dot means a new alert or a family request.
// `light` = white bell for pages without a blue header (the map).
export default function NotifBell({ light = false, slot }: { light?: boolean; slot?: string }) {
  const router = useIonRouter();
  const { newAlert, requests } = useNotifications();
  return (
    <button slot={slot} className={`bell ${light ? 'light' : ''}`} onClick={() => router.push('/tabs/alerts')} aria-label="Notifications">
      <IonIcon icon={notificationsOutline} />
      {(newAlert || requests.received.length > 0) && <i />}
    </button>
  );
}
