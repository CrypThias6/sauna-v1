/**
 * Settings, the sent-event log, and the action log.
 * On Vercel these are private Blobs. With no store connected, they stay in memory
 * for the life of the process (local dev and tests).
 * The sent log is only touched by the tick, and only after an event is due.
 */
import type { Booking } from './booking.js'
import { defaultSettings, normalizeSettings, type LightSettings } from './settings.js'

export type ActionLogEntry = {
  time: string
  action: string
  sent: boolean
  reason: string
  source: 'staff' | 'schedule'
  key?: string
}

const SETTINGS = 'sauna/settings.json'
const SENT = 'sauna/sent-log.json'
const LOG = 'sauna/action-log.json'
const BOOKINGS = 'sauna/bookings.json'
const LOG_LIMIT = 40

const memory: { settings: LightSettings | null; sent: string[]; log: ActionLogEntry[]; bookings: { at: number; bookings: Booking[] } | null } = {
  settings: null,
  sent: [],
  log: [],
  bookings: null,
}

export function storageKind(): 'blob' | 'memory' {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? 'blob' : 'memory'
}

async function readBlob<T>(pathname: string): Promise<T | null> {
  const { get } = await import('@vercel/blob')
  const result = await get(pathname, { access: 'private', useCache: false })
  if (!result || result.statusCode !== 200) return null
  const text = await new Response(result.stream).text()
  return JSON.parse(text) as T
}

async function writeBlob(pathname: string, value: unknown) {
  const { put } = await import('@vercel/blob')
  await put(pathname, JSON.stringify(value), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  })
}

export async function readSettings(): Promise<LightSettings> {
  if (storageKind() === 'memory') return memory.settings ? { ...memory.settings } : { ...defaultSettings }
  const stored = await readBlob<unknown>(SETTINGS)
  if (!stored) return { ...defaultSettings }
  return normalizeSettings(stored)
}

export async function writeSettings(settings: LightSettings) {
  const next = normalizeSettings(settings)
  if (storageKind() === 'memory') {
    memory.settings = next
    return next
  }
  await writeBlob(SETTINGS, next)
  return next
}

export async function readSentKeys(): Promise<string[]> {
  if (storageKind() === 'memory') return memory.sent.slice()
  const stored = await readBlob<{ keys?: unknown }>(SENT)
  return Array.isArray(stored?.keys) ? stored.keys.filter((key): key is string => typeof key === 'string') : []
}

export async function writeSentKeys(keys: readonly string[]) {
  const next = keys.filter((key) => typeof key === 'string')
  if (storageKind() === 'memory') {
    memory.sent = next.slice()
    return
  }
  await writeBlob(SENT, { keys: next })
}

export async function readActionLog(): Promise<ActionLogEntry[]> {
  if (storageKind() === 'memory') return memory.log.map((entry) => ({ ...entry }))
  const stored = await readBlob<{ entries?: unknown }>(LOG)
  if (!Array.isArray(stored?.entries)) return []
  return stored.entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Partial<ActionLogEntry>
    if (typeof row.time !== 'string' || typeof row.action !== 'string' || typeof row.reason !== 'string') return []
    if (row.source !== 'staff' && row.source !== 'schedule') return []
    return [{
      time: row.time,
      action: row.action,
      sent: row.sent === true,
      reason: row.reason,
      source: row.source,
      key: typeof row.key === 'string' ? row.key : undefined,
    }]
  })
}

export async function appendActionLog(entries: ActionLogEntry[]) {
  if (entries.length === 0) return
  const current = await readActionLog()
  const next = [...entries.map((entry) => ({ ...entry })), ...current].slice(0, LOG_LIMIT)
  if (storageKind() === 'memory') {
    memory.log = next
    return
  }
  await writeBlob(LOG, { entries: next })
}

export async function readBookingCache(): Promise<{ at: number; bookings: Booking[] } | null> {
  if (storageKind() === 'memory') return memory.bookings
  const stored = await readBlob<{ at?: unknown; bookings?: unknown }>(BOOKINGS)
  if (!stored || typeof stored.at !== 'number' || !Array.isArray(stored.bookings)) return null
  return { at: stored.at, bookings: stored.bookings as Booking[] }
}

export async function writeBookingCache(bookings: Booking[]) {
  const next = { at: Date.now(), bookings }
  if (storageKind() === 'memory') {
    memory.bookings = next
    return
  }
  await writeBlob(BOOKINGS, next)
}
