/**
 * Dev and preview only. The same handlers ship as Vercel Functions in /api.
 * The /sauna-bridge MCP plugin stays dev-only and is not ported.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import { handle } from '../src/server/http.js'

function readRaw(req: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 100_000) {
        reject(new Error('too big'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function toRequest(req: IncomingMessage) {
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`)
  const headers = new Headers()
  for (const name of ['cookie', 'content-type', 'authorization', 'accept']) {
    const value = req.headers[name]
    if (typeof value === 'string') headers.set(name, value)
  }
  if (method === 'GET' || method === 'HEAD') return new Request(url, { method, headers })
  const body = await readRaw(req)
  return new Request(url, { method, headers, body: new Uint8Array(body) })
}

async function writeBack(res: ServerResponse, response: Response) {
  const headers: Record<string, string | string[]> = {}
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return
    headers[key] = value
  })
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  if (cookies.length > 0) headers['set-cookie'] = cookies
  res.writeHead(response.status, headers)
  res.end(Buffer.from(await response.arrayBuffer()))
}

function attach(server: ViteDevServer | PreviewServer) {
  const env = loadEnv(server.config.mode, server.config.root, '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value
  }
  server.middlewares.use(async (req, res, next) => {
    const path = req.url?.split('?')[0] ?? ''
    if (!path.startsWith('/api/')) {
      next()
      return
    }
    try {
      const response = await handle(await toRequest(req))
      await writeBack(res, response)
    } catch {
      if (res.headersSent) return
      res.writeHead(400, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ error: 'Bad request.' }))
    }
  })
}

export function apiDevPlugin(): Plugin {
  return {
    name: 'sauna-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
