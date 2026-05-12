import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  
  return {
    base: './',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: parseInt(env.VITE_PORT || '5173'),
      proxy: {
        '/api': {
          target: 'http://localhost:9898',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers.accept === 'text/event-stream') {
                proxyReq.setHeader('Accept', 'text/event-stream')
                proxyReq.setHeader('Cache-Control', 'no-cache')
              }
            })
            proxy.on('proxyRes', (proxyRes) => {
              if (proxyRes.headers['content-type'] === 'text/event-stream') {
                proxyRes.headers['cache-control'] = 'no-cache, no-transform'
                proxyRes.headers['x-accel-buffering'] = 'no'
              }
            })
          }
        },
        '/admin': {
          target: 'http://localhost:9898',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: '../service/public/admin',
      emptyOutDir: true
    }
  }
})
