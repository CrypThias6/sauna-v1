/**
 * Retired. The token and the schedule now live in src/server and /api.
 * This module is not mounted. Do not import it from the page.
 *
 * Holds the Piqo token on the machine that runs Vite.
 * The browser only talks to /piqo/* on this same origin.
 * Actions are not sent: Piqo has not published an address for them,
 * and the current token cannot see the Sauna Twin.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { visitsOn, type Visit } from '../src/data/bookings'
import {
  emptyLights,
  isPiqoAction,
  stepLights,
  activeVisits,
  type LightMemory,
  type LightVisit,
  type PiqoAction,
} from '../src/lib/lights'

const STALE_MS = 2 * 60 * 1000
const REFUSAL =
  'Piqo has not shared an address for running Actions, and this token cannot operate the Sauna Twin. Nothing was sent.'

type SensorReading = {
  value: number
  unit: string | null
  recordedAt: string | null
  ageMs: number | null
  stale: boolean
  quality: string | null
}

type Attempt = {
  name: PiqoAction
  at: number
  source: 'schedule' | 'staff'
  sent: false
  error: string
}

export type PiqoStatus = {
  glow: 'on' | 'off' | null
  outdoor: 'on' | 'off' | null
  active: LightVisit[]
  last: Attempt[]
  operate: false
  note: string
}

type Env = {
  token: string
  base: string
  device: string
  temperature: string
  humidity: string
}

let loaded = false
let memory: LightMemory = emptyLights()
let outdoorOn = '20:30'
let outdoorOff = '23:30'
let postedDay = ''
let posted: LightVisit[] | null = null
const attempts: Attempt[] = []
/** Set when humidity cannot be read. A good reading is fetched again next poll. */
let humidityBlocked: string | null = null
let timer: ReturnType<typeof setInterval> | null = null

function loadEnv(root: string) {
  if (loaded) return
  loaded = true
  try {
    const text = readFileSync(resolve(root, '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      if (!/^PIQO_[A-Z0-9_]+$/.test(key)) continue
      if (process.env[key]) continue
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    /* No .env on this machine. Readings stay unavailable. */
  }
}

function env(): Env {
  return {
    token: process.env.PIQO_TOKEN?.trim() ?? '',
    base: (process.env.PIQO_BASE_URL || 'https://proxy2.piqo.nz').replace(/\/$/, ''),
    device: process.env.PIQO_DEVICE_ID || '606273ef-54cd-480a-b7ab-6024be6ed577',
    temperature: process.env.PIQO_COMPONENT || 'sht4x.09c38e29.temperature',
    humidity: process.env.PIQO_HUMIDITY_COMPONENT || 'sht4x.09c38e29.humidity',
  }
}

function safeError(error: unknown, token: string) {
  const message = error instanceof Error ? error.message : 'Could not reach Piqo.'
  if (token && message.includes(token)) return 'Could not reach Piqo.'
  return message.slice(0, 180)
}

function asVisits(day: string): LightVisit[] {
  if (posted && postedDay === day) return posted
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return []
  return visitsOn(year, month - 1, date).map(toLight)
}

function toLight(visit: Visit): LightVisit {
  return {
    id: visit.id,
    time: visit.time,
    minutes: visit.minutes,
    room: visit.room,
    name: visit.name,
    people: visit.people,
    status: visit.status,
  }
}

function dayKey(now: Date) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${date}`
}

function remember(name: PiqoAction, source: 'schedule' | 'staff') {
  attempts.unshift({ name, at: Date.now(), source, sent: false, error: REFUSAL })
  if (attempts.length > 12) attempts.pop()
}

export function syncBook(day: string, visits: LightVisit[], on: string, off: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    postedDay = day
    posted = visits.slice(0, 40).map((visit) => ({
      id: String(visit.id ?? ''),
      time: String(visit.time ?? ''),
      minutes: Number(visit.minutes) || 0,
      room: String(visit.room ?? ''),
      name: String(visit.name ?? ''),
      people: Number(visit.people) || 0,
      status: visit.status ? String(visit.status) : undefined,
    }))
  }
  if (/^\d{1,2}:\d{2}$/.test(on)) outdoorOn = on
  if (/^\d{1,2}:\d{2}$/.test(off)) outdoorOff = off
  tick(new Date())
}

export function tick(now = new Date()) {
  const { memory: next, actions } = stepLights(memory, now, asVisits(dayKey(now)), outdoorOn, outdoorOff)
  memory = next
  for (const name of actions) remember(name, 'schedule')
}

export function staffAction(name: unknown) {
  if (!isPiqoAction(name)) return { ok: false as const, sent: false as const, error: 'Unknown action.' }
  const now = new Date()
  const stepped = stepLights(memory, now, asVisits(dayKey(now)), outdoorOn, outdoorOff, name)
  memory = stepped.memory
  for (const action of stepped.actions) remember(action, action === name ? 'staff' : 'schedule')
  return { ok: false as const, sent: false as const, error: REFUSAL }
}

export function status(now = new Date()): PiqoStatus {
  return {
    glow: memory.glow,
    outdoor: memory.outdoor,
    active: activeVisits(asVisits(dayKey(now)), now),
    last: attempts.slice(0, 6),
    operate: false,
    note: REFUSAL,
  }
}

export function startScheduler(root: string) {
  loadEnv(root)
  if (timer) return
  tick(new Date())
  const handle = setInterval(() => tick(new Date()), 10_000)
  timer = handle
  if (typeof handle === 'object' && handle && 'unref' in handle) handle.unref()
}

function ageOf(recordedAt: string | null, now: number) {
  if (!recordedAt) return { ageMs: null, stale: true }
  const at = Date.parse(recordedAt)
  if (!Number.isFinite(at)) return { ageMs: null, stale: true }
  const ageMs = Math.max(0, now - at)
  return { ageMs, stale: ageMs > STALE_MS }
}

function readingFrom(record: Record<string, unknown> | undefined, now: number): SensorReading | null {
  const value = Number(record?.value)
  if (!record || !Number.isFinite(value)) return null
  const recordedAt = typeof record.recorded_at === 'string' ? record.recorded_at : null
  const { ageMs, stale } = ageOf(recordedAt, now)
  return {
    value,
    unit: typeof record.unit === 'string' ? record.unit : null,
    recordedAt,
    ageMs,
    stale,
    quality: typeof record.quality === 'string' ? record.quality : null,
  }
}

async function pull(config: Env, component: string) {
  const url = new URL('/api/v1/space/readings/latest', config.base)
  url.searchParams.set('device_id', config.device)
  url.searchParams.set('component', component)
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${config.token}`, accept: 'application/json' },
  })
  const text = await response.text()
  if (config.token && text.includes(config.token)) {
    return { status: response.status, body: null as unknown }
  }
  try {
    return { status: response.status, body: JSON.parse(text) as unknown }
  } catch {
    return { status: response.status, body: null }
  }
}

export async function sensor(root: string) {
  loadEnv(root)
  const config = env()
  const now = Date.now()
  if (!config.token) {
    return {
      temperature: null,
      humidity: null,
      temperatureNote: 'No Piqo token on this machine.',
      humidityNote: 'No Piqo token on this machine.',
      co: null,
      coNote: 'No CO sensor yet.',
    }
  }
  let temperature: SensorReading | null = null
  let temperatureNote: string | null = null
  let humidity: SensorReading | null = null
  let humidityNote = humidityBlocked
  try {
    const pulled = await pull(config, config.temperature)
    const records = (pulled.body as { records?: Record<string, unknown>[] } | null)?.records
    temperature = readingFrom(records?.[0], now)
    if (pulled.status === 401) temperatureNote = 'Piqo refused the sensor token.'
    else if (!temperature) temperatureNote = 'No temperature reading.'
  } catch (error) {
    temperatureNote = safeError(error, config.token)
  }
  if (!humidityBlocked) {
    try {
      const pulled = await pull(config, config.humidity)
      const records = (pulled.body as { records?: Record<string, unknown>[] } | null)?.records
      const message =
        (pulled.body as { error?: { message?: string } } | null)?.error?.message ?? ''
      if (pulled.status === 200) {
        humidity = readingFrom(records?.[0], now)
        humidityNote = humidity ? null : 'No humidity reading.'
      } else if (pulled.status === 403) {
        humidityBlocked = 'This token cannot read humidity.'
        humidityNote = humidityBlocked
      } else if (message && !message.includes(config.token)) {
        humidityNote = message.slice(0, 160)
      } else {
        humidityNote = 'Humidity is not available on this token.'
      }
    } catch (error) {
      humidityNote = safeError(error, config.token)
    }
  }
  return {
    temperature,
    humidity,
    temperatureNote,
    humidityNote,
    co: null,
    coNote: 'No CO sensor yet.',
  }
}
