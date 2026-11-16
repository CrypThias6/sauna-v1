import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mcpPlugin } from './mcp/plugin'
import { apiDevPlugin } from './mcp/api-plugin'

function siteBase(command: 'build' | 'serve') {
  const configured = process.env.VITE_BASE?.trim()
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`
  // Vercel sets VERCEL=1. GitHub Pages does not, so its build stays at /sauna-v1/.
  if (process.env.VERCEL) return '/'
  return command === 'build' ? '/sauna-v1/' : '/'
}

export default defineConfig(({ command }) => ({
  base: siteBase(command),
  plugins: [react(), ...(command === 'serve' ? [mcpPlugin(), apiDevPlugin()] : [])],
  server: {
    host: true,
    port: 5173,
  },
}))
