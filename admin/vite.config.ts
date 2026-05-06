import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  
  return {
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
          target: 'http://localhost:3002',
          changeOrigin: true
        },
        '/admin': {
          target: 'http://localhost:3002',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: '../service/public',
      emptyOutDir: true
    }
  }
})
