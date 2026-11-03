import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type Job = {
  id: string
  name: string
  args: Record<string, unknown>
  resolve: (value: unknown) => void
}

type Rpc = {
  jsonrpc?: string
  id?: number | string
  method?: string
  params?: Record<string, unknown>
}

const READ = new Set(['sauna_status', 'sauna_calendar'])
const PROTOCOLS = new Set(['2025-06-18', '2025-03-26', '2024-11-05'])

const tools = [
  {
    name: 'sauna_status',
    description: 'Temperature, people, door, lock, heater, lights, and session for each sauna.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'sauna_calendar',
    description: 'This month’s days and how many people are in the sauna now.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'set_heat',
    description: 'Set target temperature in celsius, from 40 to 100.',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', enum: ['small', 'big'] },
        celsius: { type: 'number' },
      },
      required: ['room', 'celsius'],
    },
  },
  {
    name: 'set_door',
    description: 'Open or shut a door. Opening unlocks it.',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', enum: ['small', 'big'] },
        open: { type: 'boolean' },
      },
      required: ['room', 'open'],
    },
  },
  {
    name: 'set_lock',
    description: 'Lock or unlock a door. Locking shuts it.',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', enum: ['small', 'big'] },
        locked: { type: 'boolean' },
      },
      required: ['room', 'locked'],
    },
  },
  {
    name: 'set_heater',
    description: 'Turn a heater on or off.',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', enum: ['small', 'big'] },
        on: { type: 'boolean' },
      },
      required: ['room', 'on'],
    },
  },
  {
    name: 'set_lights',
    description: 'Turn a room’s lights on or off.',
    inputSchema: {
      type: 'object',
      properties: {
        room: { type: 'string', enum: ['small', 'big'] },
        on: { type: 'boolean' },
      },
      required: ['room', 'on'],
    },
  },
  {
    name: 'switch_sauna',
    description: 'Show the small or big sauna.',
    inputSchema: {
      type: 'object',
      properties: { room: { type: 'string', enum: ['small', 'big'] } },
      required: ['room'],
    },
  },
]

let state: unknown = null
const queue: Job[] = []
const inflight = new Map<string, Job>()
let pull: ServerResponse | null = null
let jobSeq = 0

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, accept, mcp-session-id, mcp-protocol-version',
  'access-control-expose-headers': 'mcp-session-id',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
}

function send(res: ServerResponse, status: number, body: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', ...CORS })
  res.end(raw)
}

function empty(res: ServerResponse, status: number) {
  res.writeHead(status, CORS)
  res.end()
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function flush() {
  if (!pull || queue.length === 0) return
  const res = pull
  pull = null
  const job = queue.shift()
  if (!job) return
  inflight.set(job.id, job)
  send(res, 200, { id: job.id, name: job.name, args: job.args })
}

function enqueue(name: string, args: Record<string, unknown>) {
  const id = `j${++jobSeq}`
  return new Promise((resolve) => {
    const job: Job = { id, name, args, resolve }
    queue.push(job)
    const timer = setTimeout(() => {
      if (!inflight.has(id) && !queue.includes(job)) return
      const index = queue.indexOf(job)
      if (index >= 0) queue.splice(index, 1)
      inflight.delete(id)
      resolve({ ok: false, error: 'The sauna page is not open.' })
    }, 8000)
    const done = job.resolve
    job.resolve = (value) => {
      clearTimeout(timer)
      done(value)
    }
    flush()
  })
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (!tools.some((tool) => tool.name === name)) {
    return { error: { code: -32602, message: `Unknown tool ${name}` } }
  }
  if (READ.has(name)) {
    if (!state) return { error: { code: -32000, message: 'The sauna page is not open.' } }
    const snapshot = state as { rooms?: unknown; calendar?: unknown; showing?: unknown }
    if (name === 'sauna_status') {
      return { result: { content: [{ type: 'text', text: JSON.stringify({ showing: snapshot.showing, rooms: snapshot.rooms }) }] } }
    }
    return { result: { content: [{ type: 'text', text: JSON.stringify(snapshot.calendar) }] } }
  }
  const value = (await enqueue(name, args)) as { ok?: boolean }
  return {
    result: {
      content: [{ type: 'text', text: JSON.stringify(value) }],
      isError: value?.ok === false,
    },
  }
}

function protocolOf(message: Rpc) {
  const requested = String((message.params?.protocolVersion as string | undefined) ?? '')
  return PROTOCOLS.has(requested) ? requested : '2025-03-26'
}

async function handle(message: Rpc) {
  const id = message.id
  const method = message.method
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: protocolOf(message),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'sauna', version: '0.1.0' },
        instructions: 'Control the open sauna page. Rooms are small and big.',
      },
    }
  }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools } }
  }
  if (method === 'resources/list') {
    return { jsonrpc: '2.0', id, result: { resources: [] } }
  }
  if (method === 'resources/templates/list') {
    return { jsonrpc: '2.0', id, result: { resourceTemplates: [] } }
  }
  if (method === 'prompts/list') {
    return { jsonrpc: '2.0', id, result: { prompts: [] } }
  }
  if (method === 'logging/setLevel') {
    return { jsonrpc: '2.0', id, result: {} }
  }
  if (method === 'tools/call') {
    const params = message.params ?? {}
    const name = String(params.name ?? '')
    const args = (params.arguments as Record<string, unknown> | undefined) ?? {}
    const outcome = await callTool(name, args)
    if ('error' in outcome && outcome.error) return { jsonrpc: '2.0', id, error: outcome.error }
    return { jsonrpc: '2.0', id, result: outcome.result }
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method ?? ''}` } }
}

export function mcpPlugin(): Plugin {
  return {
    name: 'sauna-mcp',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/mcp' && url !== '/sauna-bridge/state' && url !== '/sauna-bridge/pull' && url !== '/sauna-bridge/reply') {
          next()
          return
        }
        if (req.method === 'OPTIONS') {
          send(res, 204, undefined)
          return
        }
        try {
          if (url === '/mcp' && req.method === 'GET') {
            const accept = req.headers.accept ?? ''
            // Streamable HTTP clients open a server-push stream with this Accept.
            // This server has nothing to push. 405 tells them to use POST only.
            // A browser visit still gets a short note so the address is obviously alive.
            if (accept.includes('text/event-stream')) {
              res.writeHead(405, { allow: 'POST, DELETE, OPTIONS', ...CORS })
              res.end()
              return
            }
            send(res, 200, { name: 'sauna', mcp: '/mcp' })
            return
          }
          if (url === '/mcp' && req.method === 'DELETE') {
            empty(res, 204)
            return
          }
          if (url === '/sauna-bridge/state' && req.method === 'POST') {
            state = JSON.parse((await readBody(req)) || 'null')
            send(res, 204, undefined)
            return
          }
          if (url === '/sauna-bridge/pull' && req.method === 'GET') {
            if (queue.length > 0) {
              pull = res
              flush()
              return
            }
            pull = res
            const timer = setTimeout(() => {
              if (pull !== res) return
              pull = null
              send(res, 204, undefined)
            }, 20000)
            res.on('close', () => {
              clearTimeout(timer)
              if (pull === res) pull = null
            })
            return
          }
          if (url === '/sauna-bridge/reply' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req)) as { id?: string; result?: unknown }
            const job = body.id ? inflight.get(body.id) : undefined
            if (job) {
              inflight.delete(job.id)
              job.resolve(body.result)
            }
            send(res, 204, undefined)
            return
          }
          if (url === '/mcp' && req.method === 'POST') {
            const parsed = JSON.parse(await readBody(req)) as Rpc | Rpc[]
            const messages = Array.isArray(parsed) ? parsed : [parsed]
            const requests = messages.filter((message) => message.id !== undefined)
            if (requests.length === 0) {
              empty(res, 202)
              return
            }
            const responses = []
            for (const message of requests) responses.push(await handle(message))
            send(res, 200, Array.isArray(parsed) ? responses : responses[0])
            return
          }
          send(res, 405, { error: 'Method not allowed' })
        } catch (error) {
          send(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: error instanceof Error ? error.message : 'Bad request' } })
        }
      })
    },
  }
}
