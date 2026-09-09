import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all local network interfaces (0.0.0.0)
    port: 5173,
    cors: true,
    allowedHosts: true, // Allow all tunnel domains (localhost.run, pinggy, ngrok, cloudflare)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});
