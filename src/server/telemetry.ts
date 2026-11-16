/** Pull the latest Piqo reading. A missing value stays blank. It is never reported as 0. */

const STALE_MS = 2 * 60 * 1000

export type SensorReading = {
  value: number
  unit: string | null
  recordedAt: string | null
  ageMs: number | null
  stale: boolean
  quality: string | null
}

type PullConfig = {
  token: string
  base: string
  device: string
  temperature: string
  humidity: string
}

let humidityBlocked: string | null = null

function config(): PullConfig {
  return {
    token: (process.env.PIQO_READ_TOKEN || process.env.PIQO_TOKEN || '').trim(),
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

function ageOf(recordedAt: string | null, now: number) {
  if (!recordedAt) return { ageMs: null as number | null, stale: true }
  const at = Date.parse(recordedAt)
  if (!Number.isFinite(at)) return { ageMs: null, stale: true }
  const ageMs = Math.max(0, now - at)
  return { ageMs, stale: ageMs > STALE_MS }
}

function readingFrom(record: Record<string, unknown> | undefined, now: number): SensorReading | null {
  if (!record || record.value == null || record.value === '') return null
  const value = typeof record.value === 'number' ? record.value : Number(record.value)
  if (!Number.isFinite(value)) return null
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

async function pull(current: PullConfig, component: string) {
  const url = new URL('/api/v1/space/readings/latest', current.base)
  url.searchParams.set('device_id', current.device)
  url.searchParams.set('component', component)
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${current.token}`, accept: 'application/json' },
  })
  const text = await response.text()
  if (current.token && text.includes(current.token)) return { status: response.status, body: null as unknown }
  try {
    return { status: response.status, body: JSON.parse(text) as unknown }
  } catch {
    return { status: response.status, body: null }
  }
}

export async function readTelemetry() {
  const current = config()
  const now = Date.now()
  if (!current.token) {
    return {
      temperature: null,
      humidity: null,
      temperatureNote: 'No Piqo token on this server.',
      humidityNote: 'No Piqo token on this server.',
      co: null,
      coNote: 'No CO sensor yet.',
    }
  }
  let temperature: SensorReading | null = null
  let temperatureNote: string | null = null
  let humidity: SensorReading | null = null
  let humidityNote = humidityBlocked
  try {
    const pulled = await pull(current, current.temperature)
    const records = (pulled.body as { records?: Record<string, unknown>[] } | null)?.records
    temperature = readingFrom(records?.[0], now)
    if (pulled.status === 401) temperatureNote = 'Piqo refused the sensor token.'
    else if (!temperature) temperatureNote = 'No temperature reading.'
  } catch (error) {
    temperatureNote = safeError(error, current.token)
  }
  if (!humidityBlocked) {
    try {
      const pulled = await pull(current, current.humidity)
      const records = (pulled.body as { records?: Record<string, unknown>[] } | null)?.records
      const message = (pulled.body as { error?: { message?: string } } | null)?.error?.message ?? ''
      if (pulled.status === 200) {
        humidity = readingFrom(records?.[0], now)
        humidityNote = humidity ? null : 'No humidity reading.'
      } else if (pulled.status === 403) {
        humidityBlocked = 'This token cannot read humidity.'
        humidityNote = humidityBlocked
      } else if (message && !message.includes(current.token)) {
        humidityNote = message.slice(0, 160)
      } else {
        humidityNote = 'Humidity is not available on this token.'
      }
    } catch (error) {
      humidityNote = safeError(error, current.token)
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
