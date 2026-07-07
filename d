import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/kryashen': {
        target: 'http://95.163.242.153',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: {
          '/': '/'
        },
        rewrite: function (path) {
          return path.replace(/^\/kryashen/, '/index.php/kryashen')
        },
        configure: function (proxy) {
          proxy.on('proxyRes', function (proxyRes, req, res) {
            var location = proxyRes.headers['location']
            if (location) {
              // Handle all redirects - full URLs
              location = location.replace(
                /https?:\/\/95\.163\.242\.153\/index\.php\/kryashen\//g,
                'http://localhost:5173/kryashen/'
              )
              location = location.replace(
                /https?:\/\/95\.163\.242\.153\/ru\//g,
                'http://localhost:5173/kryashen/ru/'
              )
              location = location.replace(
                /https?:\/\/95\.163\.242\.153\//g,
                'http://localhost:5173/kryashen/'
              )
              proxyRes.headers['location'] = location
            }
            // Add CORS headers for credentials mode
            var origin = req.headers.origin || 'http://localhost:5173'
            res.setHeader('Access-Control-Allow-Origin', origin)
            res.setHeader('Access-Control-Allow-Credentials', 'true')
          })
        }
      }
    }
  }
})