import { IonButton, IonContent, IonFooter, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuToggle } from '@ionic/react';
import { businessOutline, gridOutline, logOutOutline, megaphone, peopleOutline, warningOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';

const PAGES = [
  { url: '/dashboard', icon: gridOutline, title: 'Dashboard' },
  { url: '/incidents', icon: warningOutline, title: 'Incident Reports' },
  { url: '/residents', icon: peopleOutline, title: 'Residents' },
  { url: '/evacuation', icon: businessOutline, title: 'Evacuation Centers' },
];

export default function Menu({ onLogout }: { onLogout: () => void }) {
  const { pathname } = useLocation();
  const name = localStorage.getItem('admin_name') ?? 'Admin';

  return (
    <IonMenu contentId="main" type="overlay" className="admin-menu">
      <IonContent>
        <div className="logo">
          <span className="logo-mark"><IonIcon icon={megaphone} /></span>
          <div>
            <b>Calap Alert</b>
            <small>Admin Portal · CDRRMO</small>
          </div>
        </div>
        <div className="menu-label">MAIN MENU</div>
        <IonList lines="none">
          {PAGES.map((p) => (
            <IonMenuToggle key={p.url} autoHide={false}>
              <IonItem
                routerLink={p.url}
                routerDirection="root"
                detail={false}
                button
                className={pathname.startsWith(p.url) ? 'selected' : ''}
              >
                <IonIcon slot="start" icon={p.icon} />
                <IonLabel>{p.title}</IonLabel>
              </IonItem>
            </IonMenuToggle>
          ))}
        </IonList>
      </IonContent>
      <IonFooter className="menu-footer">
        <div className="user-card">
          <span className="avatar">{name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
          <div className="grow">
            <b>{name}</b>
            <small>Ibaba East &amp; Ibaba West</small>
          </div>
          <IonButton fill="clear" size="small" onClick={onLogout} title="Log out">
            <IonIcon slot="icon-only" icon={logOutOutline} />
          </IonButton>
        </div>
      </IonFooter>
    </IonMenu>
  );
}
