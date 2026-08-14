import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('gsap') || id.includes('framer-motion')) {
              return 'vendor-animation'
            }
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'vendor-icons'
            }
            if (id.includes('socket.io-client') || id.includes('axios') || id.includes('zustand')) {
              return 'vendor-socket'
            }
            if (id.includes('react-syntax-highlighter') || id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('prismjs') || id.includes('refractor')) {
              return 'vendor-syntax'
            }
          }
        },
      },
    },
  },
})

