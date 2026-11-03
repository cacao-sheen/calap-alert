import { IonIcon } from '@ionic/react';
import { businessOutline, gridOutline, logOutOutline, moonOutline, peopleOutline, sunnyOutline, warningOutline } from 'ionicons/icons';
import { useState, type ReactNode } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { applyTheme, isDark } from '../darkMode';
import LogoMark from './LogoMark';

const PAGES = [
  { url: '/dashboard', icon: gridOutline, title: 'Dashboard' },
  { url: '/incidents', icon: warningOutline, title: 'Incidents' },
  { url: '/residents', icon: peopleOutline, title: 'Residents' },
  { url: '/evacuation', icon: businessOutline, title: 'Centers' },
];

// Frame around every admin page: top bar (logo, account) + icon rail on the left
export default function Shell({ onLogout, children }: { onLogout: () => void; children: ReactNode }) {
  const history = useHistory();
  const { pathname } = useLocation();
  const name = localStorage.getItem('admin_name') ?? 'Admin';
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const [dark, setDark] = useState(isDark);
  const toggleTheme = () => {
    applyTheme(!dark);
    setDark(!dark);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo-mark"><LogoMark size={32} /></span>
          <div className="brand-text">
            <b>Calap Alert</b>
            <small>CDRRMO Admin Portal</small>
          </div>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IonIcon icon={dark ? sunnyOutline : moonOutline} />
          <span>{dark ? 'Light' : 'Dark'}</span>
        </button>
        <div className="account">
          <span className="avatar">{initials}</span>
          <div className="account-text">
            <b>{name}</b>
            <small>Ibaba East &amp; West</small>
          </div>
        </div>
      </header>

      <div className="shell-body">
        <nav className="rail">
          {PAGES.map((p) => (
            <button key={p.url} className={`rail-item ${pathname.startsWith(p.url) ? 'active' : ''}`} onClick={() => history.push(p.url)} title={p.title}>
              <IonIcon icon={p.icon} />
              <span>{p.title}</span>
            </button>
          ))}
          <button className="rail-item logout" onClick={onLogout} title="Log out">
            <IonIcon icon={logOutOutline} />
            <span>Log out</span>
          </button>
        </nav>
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
