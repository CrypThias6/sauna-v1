import { useSyncExternalStore } from 'react'
import type { SensorLink } from './sensor-status'
import { markSession, subscribeSession } from './session'

export type SensorPull = { name: string; status: number; records: number }

export type LiveReading = {
  value: number
  unit: string | null
  recordedAt: string | null
  ageMs: number | null
  stale: boolean
  quality: string | null
}

export type LiveSensor = {
  celsius: number | null
  humidityPercent: number | null
  recordedAt: string | null
  offline: boolean
  error: string | null
  humidityError: string | null
  link: SensorLink
  heardAt: string | null
  reachable: boolean
  known: boolean
  debug: { pulls: SensorPull[] } | null
  temperature: LiveReading | null
  humidity: LiveReading | null
}

const empty: LiveSensor = {
  celsius: null,
  humidityPercent: null,
  recordedAt: null,
  offline: true,
  error: null,
  humidityError: null,
  link: 'offline',
  heardAt: null,
  reachable: false,
  known: false,
  debug: null,
  temperature: null,
  humidity: null,
}

let current = empty
const listeners = new Set<() => void>()
let timer: number | null = null
let inflight = false

function emit() {
  for (const listener of listeners) listener()
}

function reading(value: unknown): LiveReading | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<LiveReading>
  if (typeof row.value !== 'number' || !Number.isFinite(row.value)) return null
  return {
    value: row.value,
    unit: typeof row.unit === 'string' ? row.unit : null,
    recordedAt: typeof row.recordedAt === 'string' ? row.recordedAt : null,
    ageMs: typeof row.ageMs === 'number' ? row.ageMs : null,
    stale: row.stale === true,
    quality: typeof row.quality === 'string' ? row.quality : null,
  }
}

function apply(body: unknown) {
  if (!body || typeof body !== 'object') {
    current = { ...empty, error: 'Sensor response could not be read.' }
    return
  }
  const row = body as Partial<LiveSensor> & { debug?: { pulls?: SensorPull[] } }
  const temperature = reading(row.temperature)
  const humidity = reading(row.humidity)
  current = {
    celsius: typeof row.celsius === 'number' && Number.isFinite(row.celsius) ? row.celsius : temperature?.value ?? null,
    humidityPercent: typeof row.humidityPercent === 'number' && Number.isFinite(row.humidityPercent) ? row.humidityPercent : humidity?.value ?? null,
    recordedAt: typeof row.recordedAt === 'string' ? row.recordedAt : temperature?.recordedAt ?? null,
    offline: row.offline !== false,
    error: typeof row.error === 'string' ? row.error : null,
    humidityError: typeof row.humidityError === 'string' ? row.humidityError : null,
    link: row.link === 'online' || row.link === 'offline' || row.link === 'unreachable' ? row.link : 'offline',
    heardAt: typeof row.heardAt === 'string' ? row.heardAt : null,
    reachable: row.reachable === true,
    known: true,
    debug: Array.isArray(row.debug?.pulls) ? { pulls: row.debug.pulls } : null,
    temperature,
    humidity,
  }
}

async function load() {
  if (inflight) return
  inflight = true
  try {
    const response = await fetch('/api/telemetry', { headers: { accept: 'application/json' }, credentials: 'same-origin' })
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null
    if (response.status === 401) {
      markSession('needed')
      return
    }
    if (!response.ok) {
      current = {
        ...empty,
        known: true,
        link: 'unreachable',
        error: typeof body?.error === 'string' ? body.error : `Sensor request failed (${response.status}).`,
        humidityError: typeof body?.error === 'string' ? body.error : `Sensor request failed (${response.status}).`,
      }
      emit()
      return
    }
    apply(body)
    emit()
  } catch {
    current = { ...empty, known: true, link: 'unreachable', error: "Can't reach Piqo", humidityError: "Can't reach Piqo" }
    emit()
  } finally {
    inflight = false
  }
}

function ensure() {
  if (timer != null) return
  void load()
  timer = window.setInterval(() => void load(), 20_000)
  subscribeSession(() => void load())
}

export function getLiveSensor() {
  return current
}

export function subscribeLive(listener: () => void) {
  listeners.add(listener)
  ensure()
  return () => listeners.delete(listener)
}

export function useLiveSensor() {
  return useSyncExternalStore(subscribeLive, getLiveSensor, () => empty)
}
