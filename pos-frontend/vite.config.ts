import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3001,
    strictPort: true, // fail fast if 3001 is taken rather than silently picking 5173
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false, // SW disabled in dev to prevent stale cache intercepting requests
      },
      workbox: {
        // Never cache auth, sales, refunds, or any write endpoints
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Auth + all write/mutation endpoints → always go to network
            urlPattern: /\/api\/v1\/(auth|sales|refunds|inventory|shifts|users|reports|ecommerce\/auth|ecommerce\/cart|ecommerce\/orders)/,
            handler: 'NetworkOnly',
          },
          {
            // Read-heavy catalog data — serve stale, refresh in background
            urlPattern: /\/api\/v1\/(products|categories|stores|promotions)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pos-api-catalog',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 2 }, // 2 hours
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'MartPOS',
        short_name: 'MartPOS',
        description: 'Point of Sale Terminal',
        theme_color: '#1a1a2e',
        background_color: '#0f0f1a',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
