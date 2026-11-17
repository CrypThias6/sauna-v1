import type { Party } from './people'
import { peopleInRoom } from './people'
import { formatTemp } from './format'
import type { Settings } from './settings'
import type { Sauna } from '../types'
import type { SensorLink } from './sensor-status'

export type CheckAction = 'lock' | 'heater' | 'lights'

export type Check = {
  id: string
  label: string
  value: string
  ok: boolean
  action?: CheckAction
  watch: string | null
  alert: string | null
}

export type LiveCheck = {
  celsius: number | null
  error: string | null
  humidity: number | null
  humidityError: string | null
  link: SensorLink | null
}

function row(id: string, label: string, value: string, ok: boolean, watch: string | null, alert: string | null): Check {
  return { id, label, value, ok, watch: ok ? watch : watch, alert: ok ? null : alert }
}

function current(bookings: Party[], now: number, room: string) {
  return bookings.filter((booking) => {
    if (booking.status === 'cancelled' || booking.status === 'canceled') return false
    const start = Date.parse(booking.start)
    const end = Date.parse(booking.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now >= end) return false
    if (booking.room && booking.room !== room) return false
    return true
  })
}

/** Staff checklist. Sensor and humidity come from Piqo. People come from the booking. No demo numbers. */
export function roomChecks(
  sauna: Sauna,
  _settings: Settings,
  now: number,
  live: LiveCheck = { celsius: null, error: null, humidity: null, humidityError: null, link: null },
  book: { connected: boolean; bookings: Party[] } = { connected: false, bookings: [] },
): Check[] {
  const checks: Check[] = []
  const sensorValue =
    live.link === 'online' ? 'Online' : live.link === 'offline' ? 'Offline' : live.link === 'unreachable' ? "Can't reach Piqo" : '—'
  checks.push(row('sensor', 'Wi-Fi', sensorValue, live.link === 'online', live.link, live.link === 'online' ? null : sensorValue))

  const humidOk = live.humidity != null && live.humidity >= 0 && live.humidity <= 100
  checks.push(
    row(
      'humidity',
      'Humidity',
      live.humidity == null ? `— · ${live.humidityError || 'No humidity reading.'}` : `${live.humidity}%`,
      humidOk,
      humidOk ? null : 'humidity',
      humidOk ? null : 'Humidity needs a look',
    ),
  )

  const air = live.celsius == null ? null : `${formatTemp(live.celsius)}°`
  checks.push(row('temp', 'Temp', air == null ? `— · ${live.error || 'No temperature reading.'}` : air, air != null, null, null))

  const here = book.connected ? current(book.bookings, now, sauna.name) : []
  const session = here[0]
  let sessionValue = 'Booking calendar not connected'
  if (book.connected) {
    if (!session) sessionValue = 'No booking'
    else {
      const remain = Math.max(0, Math.round((Date.parse(session.end) - now) / 60_000))
      sessionValue = session.people == null ? `Booking · ${remain} min` : `${remain} min`
    }
  }
  checks.push(row('session', 'Session', sessionValue, true, null, null))

  const people = book.connected ? peopleInRoom(book.bookings, now, sauna.name) : null
  checks.push(
    row(
      'people',
      'People',
      !book.connected ? '—' : people == null ? '—' : String(people),
      book.connected && people != null,
      null,
      null,
    ),
  )

  checks.push(row('co', 'CO', '— No CO sensor', true, null, null))
  return checks
}
