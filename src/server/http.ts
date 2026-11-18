/**
 * Staff routes need the session cookie. POST /api/tick needs Authorization: Bearer CRON_SECRET.
 * Tick never reads the sensor.
 */
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  delayIfLocked,
  noteLoginFailure,
  noteLoginSuccess,
  readCookie,
  sameSecret,
  sessionCookie,
  sessionLive,
  signSession,
  staffConfigured,
} from './auth.js'
import type { Booking } from './booking.js'
import { applyWebhookBooking, bookingStatus, loadDay, loadMonth, webhookLooksCancelled } from './bookings.js'
import { simplyBookConfigured } from './simplybook.js'
import { isPiqoAction, lightOf, runPiqoAction } from './piqo.js'
import { CATCH_UP_MS, bookingDates, runTick } from './schedule.js'
import { normalizeSettings } from './settings.js'
import { appendActionLog, readActionLog, readSentKeys, readSettings, storageKind, writeSentKeys, writeSettings, type ActionLogEntry } from './store.js'
import { readTelemetry } from './telemetry.js'
import { siteZone } from './time.js'

function json(body: unknown, status = 200, extra?: HeadersInit) {
  const headers = new Headers(extra)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

function requireStaff(request: Request) {
  if (!staffConfigured()) return json({ error: 'Staff login is not configured.' }, 503)
  const secret = process.env.SESSION_SECRET?.trim() ?? ''
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE)
  if (!token || !sessionLive(token, secret)) return json({ error: 'Sign in required.' }, 401)
  return null
}

async function readBody(request: Request) {
  const text = await request.text()
  if (text.length > 20_000) throw new Error('bad')
  if (!text.trim()) return {}
  return JSON.parse(text) as unknown
}

function cronOk(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? ''
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  return sameSecret(header.slice('Bearer '.length).trim(), secret)
}

async function postLogin(request: Request) {
  await delayIfLocked()
  if (!staffConfigured()) return json({ error: 'Staff login is not configured.' }, 503)
  let body: unknown
  try {
    body = await readBody(request)
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  const password = body && typeof body === 'object' && 'password' in body ? String((body as { password?: unknown }).password ?? '') : ''
  const expected = process.env.STAFF_PASSWORD?.trim() ?? ''
  if (!sameSecret(password, expected)) {
    const count = noteLoginFailure()
    if (count >= 5) await new Promise((resolve) => setTimeout(resolve, 2000))
    return json({ error: 'Wrong password.' }, 401)
  }
  noteLoginSuccess()
  const token = signSession(process.env.SESSION_SECRET?.trim() ?? '')
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_MAX_AGE) })
}

async function postLogout(request: Request) {
  const denied = requireStaff(request)
  if (denied) return denied
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) })
}

async function getTelemetry(request: Request) {
  const denied = requireStaff(request)
  if (denied) return denied
  return json(await readTelemetry())
}

async function getBookings(request: Request) {
  const denied = requireStaff(request)
  if (denied) return denied
  const url = new URL(request.url)
  if (url.searchParams.get('status') === '1') return json(await bookingStatus())
  const month = url.searchParams.get('month') ?? ''
  const date = url.searchParams.get('date') ?? ''
  if (!month && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Use date=YYYY-MM-DD or month=YYYY-MM.' }, 400)
  const loaded = month ? await loadMonth(month) : await loadDay(date)
  return json({ date: date || null, month: month || null, connected: loaded.connected, bookings: loaded.bookings, error: loaded.error })
}

async function getSettings(request: Request) {
  const denied = requireStaff(request)
  if (denied) return denied
  try {
    return json(await readSettings())
  } catch {
    return json({ error: 'Settings are unavailable.' }, 500)
  }
}

async function putSettings(request: Request) {
  const denied = requireStaff(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await readBody(request)
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  try {
    const next = await writeSettings(normalizeSettings(body, await readSettings()))
    return json(next)
  } catch {
    return json({ error: 'Settings are unavailable.' }, 500)
  }
}

function lastToggleAt(entries: ActionLogEntry[], action: string) {
  const light = lightOf(action)
  if (!light) return null
  for (const entry of entries) {
    if (entry.reason === 'too soon') continue
    if (lightOf(entry.action) !== light) continue
    const at = Date.parse(entry.time)
    if (Number.isFinite(at)) return at
  }
  return null
}

async function postAction(request: Request) {
  const denied = requireStaff(request)
  if (denied) return denied
  let body: unknown
  try {
    body = await readBody(request)
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  const action = body && typeof body === 'object' && 'action' in body ? (body as { action?: unknown }).action : undefined
  if (!isPiqoAction(action)) return json({ error: 'Unknown action.' }, 400)
  let log: ActionLogEntry[]
  try {
    log = await readActionLog()
  } catch {
    return json({ error: 'The log is unavailable.' }, 500)
  }
  const outcome = await runPiqoAction(action, { checkGap: true, lastToggleAt: lastToggleAt(log, action) })
  try {
    await appendActionLog([{
      time: new Date().toISOString(),
      action,
      sent: outcome.sent,
      reason: outcome.reason,
      source: 'staff',
    }])
  } catch {
    return json({ error: 'The log is unavailable.' }, 500)
  }
  return json({
    ok: outcome.ok,
    receiptId: outcome.receiptId,
    state: outcome.state,
    sent: outcome.sent,
    reason: outcome.reason,
    error: outcome.error ?? null,
    recorded: true,
    note: outcome.ok ? 'sent' : 'recorded, not sent',
  })
}

async function postTick(request: Request) {
  if (!cronOk(request)) return json({ error: 'Unauthorized.' }, 401)
  const now = new Date()
  const zone = siteZone()
  let settings
  try {
    settings = await readSettings()
  } catch {
    return json({ error: 'Settings are unavailable.' }, 500)
  }
  const bookings: Booking[] = []
  if (simplyBookConfigured()) {
    try {
      for (const date of bookingDates(now, CATCH_UP_MS, zone)) {
        bookings.push(...(await loadDay(date)).bookings)
      }
    } catch {
      return json({ error: 'Bookings are unavailable.' }, 503)
    }
  }
  try {
    const result = await runTick({
      now,
      bookings,
      settings,
      timeZone: zone,
      sent: { read: readSentKeys, write: writeSentKeys },
      fire: async (event) => {
        const outcome = await runPiqoAction(event.action)
        await appendActionLog([{
          time: new Date().toISOString(),
          action: event.action,
          sent: outcome.sent,
          reason: outcome.reason,
          source: 'schedule',
          key: event.key,
        }])
      },
    })
    return json({
      fired: result.fired.map((event) => ({ key: event.key, action: event.action, at: event.at })),
      persisted: storageKind() === 'blob',
    })
  } catch {
    return json({ error: 'The schedule could not be recorded.' }, 500)
  }
}

async function getLog(request: Request) {
  const denied = requireStaff(request)
  if (denied) return denied
  const raw = Number(new URL(request.url).searchParams.get('limit') ?? 20)
  const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.round(raw))) : 20
  try {
    const entries = await readActionLog()
    return json({ entries: entries.slice(0, limit) })
  } catch {
    return json({ error: 'The log is unavailable.' }, 500)
  }
}

async function postWebhook(request: Request) {
  const secret = process.env.SIMPLYBOOK_WEBHOOK_SECRET?.trim() ?? ''
  const given = new URL(request.url).searchParams.get('secret') ?? ''
  if (!secret || !simplyBookConfigured()) return json({ error: 'not configured' }, 503)
  if (!sameSecret(given, secret)) return json({ error: 'Unauthorized.' }, 401)
  let body: unknown
  try {
    body = await readBody(request)
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const id = String(record.booking_id ?? record.bookingId ?? '').trim()
  if (!id) return json({ error: 'Bad request.' }, 400)
  const notice = String(record.notification_type ?? record.notificationType ?? '')
  try {
    await applyWebhookBooking(id, webhookLooksCancelled(notice))
  } catch {
    return json({ error: 'Bookings are unavailable.' }, 503)
  }
  return json({ ok: true })
}

const routes: Record<string, Partial<Record<string, (request: Request) => Promise<Response>>>> = {
  '/api/login': { POST: postLogin },
  '/api/logout': { POST: postLogout },
  '/api/telemetry': { GET: getTelemetry },
  '/api/bookings': { GET: getBookings },
  '/api/settings': { GET: getSettings, PUT: putSettings },
  '/api/action': { POST: postAction },
  '/api/tick': { POST: postTick },
  '/api/log': { GET: getLog },
  '/api/simplybook-webhook': { POST: postWebhook },
}

export function handle(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
  const methods = routes[path]
  if (!methods) return Promise.resolve(json({ error: 'Not found.' }, 404))
  const run = methods[request.method.toUpperCase()]
  if (!run) return Promise.resolve(json({ error: 'Method not allowed.' }, 405))
  return run(request)
}
