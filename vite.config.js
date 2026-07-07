import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// CORS заголовки для development (credentials require exact origin)
function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'http://localhost:5174',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With'
  }
}

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
    proxy: {
      '/kryashen': {
        target: 'http://95.163.242.153',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        secure: false,
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
              // Используем текущий origin вместо хардкода localhost:5173
              var currentOrigin = req.headers.origin || 'http://localhost:5173'
              location = location.replace(
                /https?:\/\/95\.163\.242\.153\/index\.php\/kryashen\//g,
                currentOrigin + '/kryashen/'
              )
              location = location.replace(
                /https?:\/\/95\.163\.242\.153\/ru\//g,
                currentOrigin + '/kryashen/ru/'
              )
              proxyRes.headers['location'] = location
            }
            // Применяем CORS заголовки с точным origin
            var headers = getCorsHeaders(req.headers.origin)
            Object.keys(headers).forEach(function (key) {
              res.setHeader(key, headers[key])
            })
          })
        }
      },
      '/ru': {
        target: 'http://95.163.242.153',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: {
          '/': '/'
        },
        rewrite: function (path) {
          return '/index.php' + path
        },
        configure: function (proxy) {
          proxy.on('proxyRes', function (proxyRes, req, res) {
            var location = proxyRes.headers['location']
            if (location) {
              // Используем текущий origin вместо хардкода
              var currentOrigin = req.headers.origin || 'http://localhost:5173'
              location = location.replace(
                /https?:\/\/95\.163\.242\.153\/ru\//g,
                currentOrigin + '/kryashen/ru/'
              )
              location = location.replace(
                /https?:\/\/95\.163\.242\.153\//g,
                currentOrigin + '/kryashen/'
              )
              if (location.startsWith('/')) {
                location = currentOrigin + '/kryashen' + location
              }
              proxyRes.headers['location'] = location
            }
            // Применяем CORS заголовки с точный origin
            var headers = getCorsHeaders(req.headers.origin)
            Object.keys(headers).forEach(function (key) {
              res.setHeader(key, headers[key])
            })
          })
        }
      }
    }
  }
})
