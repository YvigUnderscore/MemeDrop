import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, on proxifie l'API/WS/médias vers le serveur (port 8080 par défaut).
const target = process.env.MEMEBOMB_SERVER || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/media': { target, changeOrigin: true },
      '/compose': { target, changeOrigin: true }, // éditeur web (iframe de l'onglet Éditeur)
      '/ws': { target, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
