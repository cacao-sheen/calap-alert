import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 2500 }, // the 3D map library is large
  // Push notifications only work when Firebase's google-services.json is in the app.
  // Without it, turning them on would crash the Android app, so the code checks this flag first.
  define: { __PUSH_ENABLED__: JSON.stringify(existsSync('google-services.json')) },
});
