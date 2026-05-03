import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['shield.png', 'shield.jpg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,jpg,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/auth\/me/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-me',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^\/api\/check-in\/today-status/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-status',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Estelares Futsal',
        short_name: 'Estelares',
        description: 'Control de acceso — Estelares Futsal',
        theme_color: '#CC2222',
        background_color: '#0D0D0D',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/shield.png', sizes: '192x192', type: 'image/png' },
          { src: '/shield.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
