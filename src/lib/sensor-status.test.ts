import { describe, expect, it } from 'vitest'
import { newestHeard, piqoReachable, SENSOR_FRESH_MS, sensorLink } from './sensor-status'

const NOW = Date.parse('2026-11-17T10:00:00+13:00')

describe('sensorLink', () => {
  it('is online when the newest SHT4x reading is under 5 minutes old', () => {
    const heardAt = new Date(NOW - 60_000).toISOString()
    expect(sensorLink({ now: NOW, heardAt, reachable: true })).toBe('online')
    expect(sensorLink({ now: NOW, heardAt: new Date(NOW - SENSOR_FRESH_MS).toISOString(), reachable: true })).toBe('online')
  })

  it('is offline when the newest reading is older than 5 minutes', () => {
    const heardAt = new Date(NOW - SENSOR_FRESH_MS - 1_000).toISOString()
    expect(sensorLink({ now: NOW, heardAt, reachable: true })).toBe('offline')
  })

  it('is offline when Piqo answered but there is no reading time', () => {
    expect(sensorLink({ now: NOW, heardAt: null, reachable: true })).toBe('offline')
  })

  it('is unreachable when the Piqo calls failed, even if an old time is still known', () => {
    const heardAt = new Date(NOW - 30_000).toISOString()
    expect(sensorLink({ now: NOW, heardAt, reachable: false })).toBe('unreachable')
    expect(piqoReachable([])).toBe(false)
    expect(piqoReachable([{ status: 0 }, { status: 503 }])).toBe(false)
    expect(piqoReachable([{ status: 401 }, { status: 403 }])).toBe(false)
    expect(piqoReachable([{ status: 404 }, { status: 200 }])).toBe(true)
  })

  it('uses the newer of the temperature and humidity times', () => {
    const older = new Date(NOW - 10 * 60_000).toISOString()
    const newer = new Date(NOW - 20_000).toISOString()
    expect(newestHeard([older, newer])).toBe(newer)
    expect(newestHeard([null, undefined])).toBeNull()
  })
})
