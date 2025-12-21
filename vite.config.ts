import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['logo-aire.svg', 'logo-aire-icon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'AIRE - Armário Inteligente',
        short_name: 'AIRE',
        description: 'Armário Inteligente de Recebimentos e Entregas',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#312e81',
        theme_color: '#312e81',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/'),
            handler: 'NetworkOnly',
            method: 'GET'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true,
    host: true,
    proxy: {
      '/esp32': {
        target: 'http://192.168.1.73',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/esp32/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Authorization', 'Bearer teste')
          })
        }
      }
    }
  }
})
