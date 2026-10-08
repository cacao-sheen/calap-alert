import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ph.calapalert.app',
  appName: 'Calap Alert',
  webDir: 'dist',
  // The app page is https://localhost, so Android blocks calls to a plain http:// API unless this is on.
  // Remove it once the API is deployed with https.
  android: { allowMixedContent: true },
};

export default config;
