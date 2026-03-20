import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Campo — Gestión Agropecuaria',
        short_name: 'Campo',
        description: 'Gestión agropecuaria para Fer y Leo',
        theme_color: '#2E4F26',
        background_color: '#F5F0E4',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      }
    })
  ],
})
