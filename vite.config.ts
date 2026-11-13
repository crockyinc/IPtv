import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * AnyStream is a client-only SPA. There is no backend: the browser talks
 * directly to `iptv-org.github.io`. The only server behaviour we need from
 * Vite is history-API fallback so deep links like /watch/bbc-news resolve.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Required so the proxied preview host is accepted by Vite's host check.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          hls: ['hls.js'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
