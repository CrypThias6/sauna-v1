/**
 * Not mounted. The console now talks to /api, including during `npm run dev`.
 * This file is the old Vite middleware. Do not start its scheduler.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { sensor, staffAction, startScheduler, status, syncBook } from '../server/piqo'
import type { LightVisit } from '../src/lib/lights'

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function attach(server: ViteDevServer | PreviewServer) {
  const root = server.config.root
  startScheduler(root)
  server.middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0]
    if (url !== '/piqo/sensor' && url !== '/piqo/status' && url !== '/piqo/action' && url !== '/piqo/sync') {
      next()
      return
    }
    try {
      if (url === '/piqo/sensor' && req.method === 'GET') {
        send(res, 200, await sensor(root))
        return
      }
      if (url === '/piqo/status' && req.method === 'GET') {
        send(res, 200, status())
        return
      }
      if (url === '/piqo/sync' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}') as {
          day?: string
          visits?: LightVisit[]
          outdoorOn?: string
          outdoorOff?: string
        }
        syncBook(String(body.day ?? ''), Array.isArray(body.visits) ? body.visits : [], String(body.outdoorOn ?? ''), String(body.outdoorOff ?? ''))
        send(res, 200, status())
        return
      }
      if (url === '/piqo/action' && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '{}') as { name?: string }
        send(res, 200, { ...staffAction(body.name), status: status() })
        return
      }
      send(res, 405, { error: 'Method not allowed' })
    } catch {
      send(res, 400, { error: 'Bad request' })
    }
  })
}

export function piqoPlugin(): Plugin {
  return {
    name: 'sauna-piqo',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
