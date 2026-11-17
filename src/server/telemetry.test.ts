import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFLINE_MS, parseReadings, readTelemetry } from './telemetry.js'

const NOW = Date.parse('2026-11-17T10:00:00+13:00')
const FRESH = '2026-11-17T09:58:00+13:00'
const OLD = '2026-11-17T09:50:00+13:00'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.PIQO_READ_TOKEN
  delete process.env.PIQO_TOKEN
  delete process.env.PIQO_COMPONENT
  delete process.env.PIQO_HUMIDITY_COMPONENT
})

describe('parseReadings', () => {
  it('keeps the SHT4x temperature and humidity and drops simulated CO and moisture', () => {
    const parsed = parseReadings(
      {
        records: [
          { component: 'simulated.co', value: 0, unit: 'ppm', recorded_at: FRESH },
          { component: 'simulated.moisture', value: 40, unit: '%', recorded_at: FRESH },
          { component: 'sht4x.09c38e29.temperature', value: 84.2, unit: 'Cel', recorded_at: FRESH, quality: 'good' },
          { component: { id: 'sht4x.09c38e29.humidity', name: 'Humidity' }, value: 19, unit: '%RH', recorded_at: FRESH },
        ],
      },
      NOW,
    )
    expect(parsed.temperature).toMatchObject({ value: 84.2, unit: 'Cel', recordedAt: FRESH, stale: false })
    expect(parsed.humidity).toMatchObject({ value: 19, unit: '%', recordedAt: FRESH, stale: false })
  })

  it('accepts recordedAt and reading aliases, and leaves a missing value blank', () => {
    const parsed = parseReadings(
      {
        readings: [
          { component: 'sht4x.09c38e29.temperature', reading: null, unit: 'Cel', recordedAt: FRESH },
          { metric: 'sht4x humidity', value: '21.5', unit: 'percent', timestamp: FRESH },
        ],
      },
      NOW,
    )
    expect(parsed.temperature).toBeNull()
    expect(parsed.humidity?.value).toBe(21.5)
  })

  it('marks a reading older than 5 minutes offline and keeps a real zero', () => {
    const parsed = parseReadings(
      {
        records: [
          { component: 'sht4x.09c38e29.temperature', value: 0, unit: 'Cel', recorded_at: OLD },
        ],
      },
      NOW,
    )
    expect(parsed.temperature?.value).toBe(0)
    expect(parsed.temperature?.stale).toBe(true)
    expect(OFFLINE_MS).toBe(5 * 60 * 1000)
  })
})

describe('humidity parsing', () => {
  it('reads sht4x.09c38e29.humidity and ignores a preview moisture value', () => {
    const parsed = parseReadings(
      {
        records: [
          { stream_id: 'sht4x.09c38e29.humidity', value: '34', unit: '%', recorded_at: FRESH },
          { stream_id: 'preview.moisture', value: 80, unit: '%', recorded_at: FRESH },
        ],
      },
      NOW,
    )
    expect(parsed.humidity).toMatchObject({ value: 34, unit: '%', recordedAt: FRESH, stale: false })
    expect(parsed.temperature).toBeNull()
  })
})

describe('readTelemetry', () => {
  it('reads stream_id values that are strings or objects, and reports upstream status without the token', async () => {
    process.env.PIQO_READ_TOKEN = 'secret-read-token'
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        urls.push(String(url))
        const headers = new Headers(init.headers)
        expect(headers.get('authorization')).toBe('Bearer secret-read-token')
        const parsed = new URL(String(url))
        if (!parsed.searchParams.get('device_id') && !parsed.searchParams.get('component')) {
          return new Response(
            JSON.stringify({
              records: [
                { stream_id: 'sht4x.09c38e29.temperature', value: { celsius: '81.5' }, recorded_at: FRESH },
                { stream_id: 'sht4x.09c38e29.humidity', value: '22', recorded_at: FRESH },
                { stream_id: 'simulated.co', value: { value: 0 }, recorded_at: FRESH },
              ],
            }),
            { status: 200 },
          )
        }
        return new Response(JSON.stringify({ error: { message: 'missing' } }), { status: 404 })
      }),
    )
    const body = await readTelemetry(NOW)
    expect(urls).toHaveLength(4)
    expect(urls.every((url) => url.includes('/api/v1/space/readings/latest'))).toBe(true)
    expect(body.celsius).toBe(81.5)
    expect(body.humidityPercent).toBe(22)
    expect(body.link).toBe('online')
    expect(body.error).toBeNull()
    expect(body.debug.pulls.map((pull) => pull.name)).toEqual(['open', 'device', 'temperature', 'humidity'])
    expect(body.debug.pulls[0]).toMatchObject({ status: 200, records: 3 })
    expect(body.debug.pulls[2]).toMatchObject({ status: 404, records: 0 })
    expect(JSON.stringify(body)).not.toContain('secret-read-token')
    expect(JSON.stringify(body.debug)).not.toContain('http')
  })

  it('stays blank and offline when Piqo refuses the token', async () => {
    process.env.PIQO_READ_TOKEN = 'secret-read-token'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Use a private integration bearer token.' } }), { status: 401 })),
    )
    const body = await readTelemetry(NOW)
    expect(body.celsius).toBeNull()
    expect(body.humidityPercent).toBeNull()
    expect(body.offline).toBe(true)
    expect(body.error).toBe('Piqo refused the sensor token (401).')
    expect(body.link).toBe('unreachable')
    expect(body.debug.pulls).toHaveLength(4)
    expect(JSON.stringify(body)).not.toContain('secret-read-token')
  })
})
