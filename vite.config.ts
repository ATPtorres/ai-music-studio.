import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { agentPlugin } from './server/viteAgent'
export default defineConfig({ plugins: [react(), tailwindcss(), agentPlugin()], test: { environment: 'node' } })
