import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5200,          // EduOS always runs on 5200
    strictPort: true,    // Fail immediately if 5200 is taken — no random fallback
    proxy: {
      // Proxy /api → backend. Use 127.0.0.1 explicitly — on Windows,
      // 'localhost' can resolve to IPv6 (::1) while the backend binds IPv4 only.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

