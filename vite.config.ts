import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honors the PORT env var so preview tooling can assign a free port.
    port: Number(process.env.PORT) || 5173,
  },
})
