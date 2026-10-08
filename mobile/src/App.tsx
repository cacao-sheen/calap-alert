import {
  IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { businessOutline, homeOutline, mapOutline, personCircleOutline, warning } from 'ionicons/icons';
import { Redirect, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Home from './pages/Home';
import Login from './pages/Login';
import MapPage from './pages/MapPage';
import Register from './pages/Register';
import Report from './pages/Report';
import Evac from './pages/Evac';
import Safety from './pages/Safety';
import Result from './pages/Result';

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
import './theme/app.css';

setupIonicReact({ mode: 'md' });

function Tabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/home" component={Home} />
        <Route exact path="/tabs/map" component={MapPage} />
        <Route exact path="/tabs/report" component={Report} />
        <Route exact path="/tabs/evac" component={Evac} />
        <Route exact path="/tabs/me" component={Safety} />
        <Route exact path="/tabs/result/:kind" component={Result} />
        <Route exact path="/tabs">
          <Redirect to="/tabs/home" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="home" href="/tabs/home">
          <IonIcon icon={homeOutline} />
          <IonLabel>Home</IonLabel>
        </IonTabButton>
        <IonTabButton tab="map" href="/tabs/map">
          <IonIcon icon={mapOutline} />
          <IonLabel>Map</IonLabel>
        </IonTabButton>
        <IonTabButton tab="report" href="/tabs/report" className="tab-report">
          <IonIcon icon={warning} />
          <IonLabel>Report</IonLabel>
        </IonTabButton>
        <IonTabButton tab="evac" href="/tabs/evac">
          <IonIcon icon={businessOutline} />
          <IonLabel>Evac</IonLabel>
        </IonTabButton>
        <IonTabButton tab="me" href="/tabs/me">
          <IonIcon icon={personCircleOutline} />
          <IonLabel>Me</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

function Routes() {
  const { user } = useAuth();
  return (
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/login" render={() => (user ? <Redirect to="/tabs/home" /> : <Login />)} />
        <Route exact path="/register" render={() => (user ? <Redirect to="/tabs/home" /> : <Register />)} />
        <Route path="/tabs" render={() => (user ? <Tabs /> : <Redirect to="/login" />)} />
        <Route exact path="/">
          <Redirect to={user ? '/tabs/home' : '/login'} />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  );
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </IonApp>
  );
}
