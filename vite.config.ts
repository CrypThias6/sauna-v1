import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mcpPlugin } from './mcp/plugin'

// Project Pages serves the built app at /sauna-v1/. Dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sauna-v1/' : '/',
  plugins: [react(), mcpPlugin()],
  server: {
    host: true,
    port: 5173,
  },
}))
