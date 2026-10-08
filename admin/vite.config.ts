import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: { chunkSizeWarningLimit: 2500 }, // the 3D map library is large
});
