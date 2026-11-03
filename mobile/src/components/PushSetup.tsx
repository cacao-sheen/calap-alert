import { useIonAlert, useIonRouter } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect } from 'react';
import { api } from '../api';

declare const __PUSH_ENABLED__: boolean;

export const pushEnabled = () => __PUSH_ENABLED__ && Capacitor.isNativePlatform();

// Turns on alert notifications for the logged-in resident (Android app only).
// They arrive even when the app is closed; tapping one opens the page the admin chose (e.g. Live View).
export default function PushSetup() {
  const router = useIonRouter();
  const [present] = useIonAlert();

  useEffect(() => {
    if (!pushEnabled()) return;

    PushNotifications.addListener('registration', ({ value }) => {
      localStorage.setItem('pushToken', value);
      api('/push/register', { method: 'POST', body: { token: value } }).catch((e) => console.warn('Push register failed', e));
    });
    PushNotifications.addListener('registrationError', (e) => console.warn('Push registration error', e));

    // Tapped a notification (app was closed or in the background)
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const route = notification.data?.route;
      if (typeof route === 'string' && route.startsWith('/tabs/')) router.push(route);
    });

    // App is open: Android doesn't show the notification, so show it inside the app
    PushNotifications.addListener('pushNotificationReceived', (n) => {
      const route = n.data?.route;
      const evacuate = typeof route === 'string' && route.includes('live=1');
      present({
        header: n.title ?? 'Calap Alert',
        message: n.body ?? '',
        buttons: [
          { text: 'Close', role: 'cancel' },
          { text: evacuate ? 'Go to evacuation center' : 'Open', handler: () => { if (route) router.push(route); } },
        ],
      });
    });

    (async () => {
      // Loud, pop-up style channel so emergency alerts get noticed
      await PushNotifications.createChannel({
        id: 'alerts', name: 'Emergency alerts', description: 'Evacuation orders and barangay alerts',
        importance: 5, visibility: 1, vibration: true,
      });
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') await PushNotifications.register();
    })().catch((e) => console.warn('Push setup failed', e));

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  return null;
}
