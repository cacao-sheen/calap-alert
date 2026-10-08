import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import Menu from './components/Menu';
import Dashboard from './pages/Dashboard';
import Evacuation from './pages/Evacuation';
import Incidents from './pages/Incidents';
import Login from './pages/Login';
import Residents from './pages/Residents';

/* Ionic core CSS */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './theme/variables.css';
import './theme/admin.css';

setupIonicReact({ mode: 'md' });

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_name');
    setToken(null);
  };

  return (
    <IonApp>
      <IonReactRouter>
        {token ? (
          // Side menu is always visible on wide screens; on small screens it opens with the ☰ button
          <IonSplitPane contentId="main" when="lg">
            <Menu onLogout={logout} />
            <IonRouterOutlet id="main">
              <Route exact path="/dashboard" component={Dashboard} />
              <Route exact path="/incidents" component={Incidents} />
              <Route exact path="/residents" component={Residents} />
              <Route exact path="/evacuation" component={Evacuation} />
              <Route render={() => <Redirect to="/dashboard" />} />
            </IonRouterOutlet>
          </IonSplitPane>
        ) : (
          <IonRouterOutlet>
            <Route exact path="/login" render={() => <Login onLogin={setToken} />} />
            <Route render={() => <Redirect to="/login" />} />
          </IonRouterOutlet>
        )}
      </IonReactRouter>
    </IonApp>
  );
}
