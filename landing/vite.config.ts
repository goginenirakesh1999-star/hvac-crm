import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this project repo at /hvac-crm/.
export default defineConfig({
  base: '/hvac-crm/',
  plugins: [react()],
})
