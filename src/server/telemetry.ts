/**
 * Display-only Piqo readings for the Grove SHT4x on the Seeed XIAO.
 * Tick and runPiqoAction must not import this. Temperature never drives a light.
 *
 * Assumed latest-reading JSON (the shape the old local bridge parsed, plus a few aliases):
 * `{ records: [{ value, unit, recorded_at, quality, component }] }`.
 * `component` may be a string or `{ id, name }`. `recordedAt`, `timestamp`, and `reading`
 * are accepted too. A list may also sit under `readings`, `data`, `items`, or `results`.
 * CO, CO₂, moisture, and anything named simulated are ignored. A missing value stays null.
 */
import { newestHeard, piqoReachable, sensorLink, type SensorLink } from '../lib/sensor-status.js'

export const OFFLINE_MS = 5 * 60 * 1000

/** Grove SHT4x already used for this sauna. Not the simulated CO or moisture component. */
export const SHT_TEMPERATURE = 'sht4x.09c38e29.temperature'
export const SHT_HUMIDITY = 'sht4x.09c38e29.humidity'

export type SensorReading = {
  value: number
  unit: string | null
  recordedAt: string | null
  ageMs: number | null
  stale: boolean
  quality: string | null
}

export type SensorPull = {
  name: 'open' | 'device' | 'temperature' | 'humidity'
  status: number
  records: number
}

export type Telemetry = {
  celsius: number | null
  humidityPercent: number | null
  recordedAt: string | null
  offline: boolean
  error: string | null
  humidityError: string | null
  link: SensorLink
  heardAt: string | null
  reachable: boolean
  debug: { pulls: SensorPull[] }
  temperature: SensorReading | null
  humidity: SensorReading | null
  temperatureNote: string | null
  humidityNote: string | null
  co: null
  coNote: string
}

type PullConfig = {
  token: string
  base: string
  device: string
  temperature: string
  humidity: string
}

function config(): PullConfig {
  return {
    token: (process.env.PIQO_READ_TOKEN || process.env.PIQO_TOKEN || '').trim(),
    base: (process.env.PIQO_BASE_URL || 'https://proxy2.piqo.nz').replace(/\/$/, ''),
    device: (process.env.PIQO_DEVICE_ID || '606273ef-54cd-480a-b7ab-6024be6ed577').trim(),
    temperature: sensorComponent(process.env.PIQO_COMPONENT, SHT_TEMPERATURE),
    humidity: sensorComponent(process.env.PIQO_HUMIDITY_COMPONENT, SHT_HUMIDITY),
  }
}

function sensorComponent(value: string | undefined, fallback: string) {
  const name = value?.trim() || fallback
  if (/co2|carbon|moisture|simulated/i.test(name)) return fallback
  return name
}

function safeError(error: unknown, token: string) {
  const message = error instanceof Error ? error.message : 'Could not reach Piqo.'
  const cleaned = token && message.includes(token) ? 'Could not reach Piqo.' : message
  return cleaned.replace(/bearer\s+\S+/gi, 'bearer').slice(0, 180)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (!isRecord(value)) return ''
  return [value.id, value.name, value.component, value.metric, value.kind, value.label, value.quantity]
    .map(textOf)
    .filter(Boolean)
    .join(' ')
}

function identity(record: Record<string, unknown>) {
  return [
    record.stream_id,
    record.streamId,
    record.component,
    record.component_id,
    record.componentId,
    record.metric,
    record.name,
    record.quantity,
    record.sensor,
    record.kind,
    record.label,
  ]
    .map(textOf)
    .join(' ')
    .toLowerCase()
}

const TEMP_KEYS = ['temperature', 'temperature_c', 'temp', 'temp_c', 'celsius', 'cel', 'value', 'reading', 'v']
const HUMID_KEYS = ['humidity', 'humidity_rh', 'relative_humidity', 'rh', 'percent', 'value', 'reading', 'v']

function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = value.trim().match(/-?\d+(?:\.\d+)?/)
    if (!match) return null
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function field(record: Record<string, unknown>, kind: 'temperature' | 'humidity') {
  const raw = record.value ?? record.reading ?? record.v
  if (!isRecord(raw)) return numberOf(raw)
  const keys = kind === 'humidity' ? HUMID_KEYS : TEMP_KEYS
  for (const key of keys) {
    if (!(key in raw)) continue
    const parsed = numberOf(raw[key])
    if (parsed != null) return parsed
  }
  return null
}

function whenOf(record: Record<string, unknown>) {
  for (const key of ['recorded_at', 'recordedAt', 'timestamp', 'time', 'ts', 'at']) {
    const value = record[key]
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value
    if (typeof value === 'number' && Number.isFinite(value)) {
      const ms = value < 1e12 ? value * 1000 : value
      return new Date(ms).toISOString()
    }
  }
  return null
}

function readingFrom(record: Record<string, unknown>, now: number, unit: string | null, kind: 'temperature' | 'humidity'): SensorReading | null {
  const value = field(record, kind)
  if (value == null) return null
  const recordedAt = whenOf(record)
  const ageMs = recordedAt ? Math.max(0, now - Date.parse(recordedAt)) : null
  return {
    value,
    unit,
    recordedAt,
    ageMs,
    stale: ageMs == null || ageMs > OFFLINE_MS,
    quality: typeof record.quality === 'string' ? record.quality : null,
  }
}

function rejected(blob: string) {
  return /co2|carbon|moisture|simulated|\bco\b/.test(blob)
}

function temperatureUnit(record: Record<string, unknown>, blob: string) {
  const unit = textOf(record.unit).toLowerCase()
  if (/cel|celsius|°c|^c$/.test(unit)) return 'Cel'
  if (/sht4x|sht40|grove/.test(blob) && /temperature|\btemp\b/.test(blob)) return 'Cel'
  if (/temperature|\btemp\b/.test(blob) && !/humidity/.test(blob)) return 'Cel'
  return null
}

function humidityUnit(record: Record<string, unknown>, blob: string) {
  const unit = textOf(record.unit).toLowerCase()
  if (/%|rh|percent|humidity/.test(unit)) return '%'
  if (/humidity|relative_humidity|\brh\b/.test(blob)) return '%'
  return null
}

function plausibleTemp(value: number) {
  return value >= -40 && value <= 140
}

function plausibleHumidity(value: number) {
  return value >= 0 && value <= 100
}

function newer(a: SensorReading | null, b: SensorReading | null) {
  if (!a) return b
  if (!b) return a
  return Date.parse(b.recordedAt ?? '') > Date.parse(a.recordedAt ?? '') ? b : a
}

function rowsOf(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter(isRecord)
  if (!isRecord(body)) return []
  for (const key of ['records', 'readings', 'data', 'items', 'results']) {
    if (Array.isArray(body[key])) return body[key].filter(isRecord)
  }
  if ('value' in body || 'reading' in body) return [body]
  return []
}

/**
 * Pick the SHT4x temperature and humidity out of a Piqo readings payload.
 * `prefer` is the component this request asked for, so a bare `{ value, recorded_at }`
 * still counts when Piqo does not repeat the component name.
 */
export function parseReadings(
  body: unknown,
  now = Date.now(),
  prefer?: 'temperature' | 'humidity',
): { temperature: SensorReading | null; humidity: SensorReading | null } {
  let temperature: SensorReading | null = null
  let humidity: SensorReading | null = null
  for (const record of rowsOf(body)) {
    const blob = identity(record)
    if (rejected(blob)) continue
    const wantsHumidity = /humidity|\brh\b/.test(blob)
    const wantsTemp = !wantsHumidity && (/temperature|\btemp\b/.test(blob) || Boolean(temperatureUnit(record, blob)))
    if (wantsTemp) {
      const reading = readingFrom(record, now, 'Cel', 'temperature')
      if (reading && plausibleTemp(reading.value)) temperature = newer(temperature, reading)
      continue
    }
    if (wantsHumidity || humidityUnit(record, blob)) {
      const reading = readingFrom(record, now, '%', 'humidity')
      if (reading && plausibleHumidity(reading.value)) humidity = newer(humidity, reading)
    }
  }
  if (prefer === 'temperature' && !temperature) temperature = fallback(body, now, 'temperature')
  if (prefer === 'humidity' && !humidity) humidity = fallback(body, now, 'humidity')
  return { temperature, humidity }
}

function fallback(body: unknown, now: number, kind: 'temperature' | 'humidity') {
  let chosen: SensorReading | null = null
  for (const record of rowsOf(body)) {
    const blob = identity(record)
    if (rejected(blob)) continue
    const unit = textOf(record.unit).toLowerCase()
    if (kind === 'temperature' && (/humidity|%|rh|ppm|percent/.test(`${blob} ${unit}`))) continue
    if (kind === 'humidity' && (/temperature|\btemp\b|ppm|cel|celsius/.test(`${blob} ${unit}`))) continue
    const reading = readingFrom(record, now, kind === 'temperature' ? 'Cel' : '%', kind)
    if (!reading) continue
    if (kind === 'temperature' && !plausibleTemp(reading.value)) continue
    if (kind === 'humidity' && !plausibleHumidity(reading.value)) continue
    chosen = newer(chosen, reading)
  }
  return chosen
}

function blank(note: string | null, pulls: SensorPull[] = []): Telemetry {
  return {
    celsius: null,
    humidityPercent: null,
    recordedAt: null,
    offline: true,
    error: note,
    humidityError: note,
    link: 'unreachable',
    heardAt: null,
    reachable: false,
    debug: { pulls },
    temperature: null,
    humidity: null,
    temperatureNote: note,
    humidityNote: note,
    co: null,
    coNote: 'No CO sensor yet.',
  }
}

async function pull(current: PullConfig, name: SensorPull['name'], query: Record<string, string>): Promise<SensorPull & { body: unknown }> {
  const url = new URL('/api/v1/space/readings/latest', current.base)
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value)
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${current.token}`, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  const text = await response.text()
  if (current.token && text.includes(current.token)) return { name, status: response.status, records: 0, body: null }
  try {
    const body = JSON.parse(text) as unknown
    return { name, status: response.status, records: rowsOf(body).length, body }
  } catch {
    return { name, status: response.status, records: 0, body: null }
  }
}

function noteFor(status: number, reading: SensorReading | null, kind: 'temperature' | 'humidity', message: string, records: number) {
  if (reading && !reading.stale) return null
  if (reading?.stale) return 'Sensor offline'
  if (status === 401) return 'Piqo refused the sensor token (401).'
  if (status === 403) return kind === 'humidity' ? 'Piqo refused humidity (403).' : 'Piqo refused temperature (403).'
  if (status === 404) return `Piqo has no ${kind} reading (404).`
  if (message && status >= 400) return message.slice(0, 160)
  if (records === 0) return `Piqo returned no ${kind} records.`
  return `Piqo returned ${records} records, none were the SHT4x ${kind}.`
}

function errorMessage(body: unknown) {
  if (!isRecord(body) || !isRecord(body.error)) return ''
  return typeof body.error.message === 'string' ? body.error.message : ''
}

export async function readTelemetry(now = Date.now()): Promise<Telemetry> {
  const current = config()
  if (!current.token) return blank('No Piqo token on this server.')
  let temperature: SensorReading | null = null
  let humidity: SensorReading | null = null
  let temperatureNote: string | null = null
  let humidityNote: string | null = null
  let pulls: SensorPull[] = []
  try {
    const [open, device, tempPull, humidPull] = await Promise.all([
      pull(current, 'open', {}),
      pull(current, 'device', { device_id: current.device }),
      pull(current, 'temperature', { device_id: current.device, component: current.temperature }),
      pull(current, 'humidity', { device_id: current.device, component: current.humidity }),
    ])
    pulls = [open, device, tempPull, humidPull].map(({ name, status, records }) => ({ name, status, records }))
    const merged = parseReadings({ records: [open, device, tempPull, humidPull].flatMap((item) => rowsOf(item.body)) }, now)
    const askedTemp = parseReadings(tempPull.body, now, 'temperature')
    const askedHumid = parseReadings(humidPull.body, now, 'humidity')
    temperature = newer(merged.temperature, askedTemp.temperature)
    humidity = newer(merged.humidity, askedHumid.humidity) ?? askedTemp.humidity
    const tempMessage = errorMessage(tempPull.body)
    const humidMessage = errorMessage(humidPull.body)
    temperatureNote = noteFor(
      tempPull.status,
      temperature,
      'temperature',
      tempMessage.includes(current.token) ? '' : tempMessage,
      Math.max(open.records, device.records, tempPull.records),
    )
    humidityNote = noteFor(
      humidPull.status,
      humidity,
      'humidity',
      humidMessage.includes(current.token) ? '' : humidMessage,
      Math.max(open.records, device.records, humidPull.records),
    )
  } catch (error) {
    const message = safeError(error, current.token)
    temperatureNote = message
    humidityNote = message
  }
  const recordedAt = temperature?.recordedAt ?? humidity?.recordedAt ?? null
  const heardAt = newestHeard([temperature?.recordedAt, humidity?.recordedAt])
  const reachable = piqoReachable(pulls)
  const link = sensorLink({ now, heardAt, reachable })
  return {
    celsius: temperature?.value ?? null,
    humidityPercent: humidity?.value ?? null,
    recordedAt,
    offline: link !== 'online',
    error: temperature && !temperature.stale ? null : link === 'unreachable' ? temperatureNote || "Can't reach Piqo" : temperatureNote,
    humidityError: humidity && !humidity.stale ? null : humidityNote,
    link,
    heardAt,
    reachable,
    debug: { pulls },
    temperature,
    humidity,
    temperatureNote,
    humidityNote,
    co: null,
    coNote: 'No CO sensor yet.',
  }
}
