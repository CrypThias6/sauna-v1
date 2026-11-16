import { useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { peopleWord } from '../lib/format'
import type { PiqoAction } from '../lib/lights'
import { getSettings, updateSettings, useSettings } from '../lib/settings'
import { markSession, sessionGate, sessionGeneration, staffFetch, subscribeSession } from '../lib/session'
import { useSauna } from '../state/store'

type Reading = {
  value: number
  unit: string | null
  recordedAt: string | null
  ageMs: number | null
  stale: boolean
  quality: string | null
}

type Sensor = {
  temperature: Reading | null
  humidity: Reading | null
  temperatureNote: string | null
  humidityNote: string | null
  coNote: string | null
}

type ApiBooking = {
  id: string
  room: string
  start: string
  end: string
  people: number
  name?: string
  status: string
}

type LogEntry = {
  time: string
  action: string
  sent: boolean
  reason: string
}

type LightSettings = {
  outdoorOn: string
  outdoorOff: string
  outdoorColor: string
  glowColor: string
  flashIntervalMin: number
}

const BUTTONS: { name: PiqoAction; label: string }[] = [
  { name: 'Glow on', label: 'Glow on' },
  { name: 'Glow off', label: 'Glow off' },
  { name: 'Outdoor on', label: 'Outdoor on' },
  { name: 'Outdoor off', label: 'Outdoor off' },
  { name: 'Warning flash', label: 'Warning flash' },
]

const FLASHES = [5, 10, 15, 20, 30, 45, 60]

function ageLabel(recordedAt: string | null, now: number) {
  if (!recordedAt) return 'No time'
  const at = Date.parse(recordedAt)
  if (!Number.isFinite(at)) return 'No time'
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 120) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

function stale(recordedAt: string | null, now: number) {
  if (!recordedAt) return true
  const at = Date.parse(recordedAt)
  if (!Number.isFinite(at)) return true
  return now - at > 2 * 60 * 1000
}

function nzDay(now: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now))
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

function SensorChip({
  label,
  reading,
  note,
  now,
  digits,
}: {
  label: string
  reading: Reading | null
  note: string | null
  now: number
  digits: number
}) {
  const old = reading ? stale(reading.recordedAt, now) : false
  const value = reading ? reading.value.toFixed(digits) : null
  return (
    <div className="chip" data-stale={old || undefined}>
      <span className="k">{label}</span>
      <span className="v">
        {value ?? '—'}
        {reading?.unit === 'Cel' && <sup>°</sup>}
        {label === 'Humidity' && value != null && <small>%</small>}
      </span>
      <span className="s">
        {reading ? `${old ? 'Stale · ' : ''}${ageLabel(reading.recordedAt, now)}` : note || 'No reading'}
      </span>
    </div>
  )
}

export function Piqo() {
  const { now } = useSauna()
  const settings = useSettings()
  const generation = useSyncExternalStore(subscribeSession, sessionGeneration, () => 0)
  const gate = useSyncExternalStore(subscribeSession, sessionGate, () => 'unknown' as const)
  const [sensor, setSensor] = useState<Sensor | null>(null)
  const [sensorError, setSensorError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<ApiBooking[] | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [fault, setFault] = useState<string | null>(null)
  const minute = Math.floor(now / 60_000)

  useEffect(() => {
    const stop = new AbortController()
    const load = () => {
      staffFetch('/api/telemetry', { signal: stop.signal })
        .then(async (response) => {
          if (response.status === 401) return
          if (!response.ok) throw new Error('no sensor')
          const body = (await response.json()) as Sensor
          if (!body || typeof body !== 'object' || !('temperature' in body)) throw new Error('no sensor')
          setSensor(body)
          setSensorError(null)
        })
        .catch(() => {
          if (stop.signal.aborted) return
          setSensorError('The sensor is only available while this console is running on the Mac.')
        })
    }
    load()
    const id = window.setInterval(load, 20_000)
    return () => {
      stop.abort()
      window.clearInterval(id)
    }
  }, [generation])

  useEffect(() => {
    const stop = new AbortController()
    const date = nzDay(minute * 60_000)
    staffFetch(`/api/bookings?date=${date}`, { signal: stop.signal })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as { bookings?: ApiBooking[] }
        if (Array.isArray(body.bookings)) setBookings(body.bookings)
      })
      .catch(() => undefined)
    return () => stop.abort()
  }, [generation, minute])

  useEffect(() => {
    const stop = new AbortController()
    staffFetch('/api/settings', { signal: stop.signal })
      .then(async (response) => {
        if (response.status === 503) {
          const body = (await response.json().catch(() => null)) as { error?: unknown } | null
          if (body?.error === 'Staff login is not configured.') markSession('needed')
          return
        }
        if (!response.ok) return
        const body = (await response.json()) as LightSettings
        if (typeof body.outdoorOn !== 'string') return
        updateSettings({
          outdoorOn: body.outdoorOn,
          outdoorOff: body.outdoorOff,
          outdoorColor: body.outdoorColor,
          glowColor: body.glowColor,
          flashMin: body.flashIntervalMin,
        })
      })
      .catch(() => undefined)
    return () => stop.abort()
  }, [generation])

  useEffect(() => {
    if (gate !== 'in') return
    const stop = new AbortController()
    const load = () => {
      staffFetch('/api/log?limit=8', { signal: stop.signal })
        .then(async (response) => {
          if (!response.ok) return
          const body = (await response.json()) as { entries?: LogEntry[] }
          if (Array.isArray(body.entries)) setEntries(body.entries)
        })
        .catch(() => undefined)
    }
    load()
    const id = window.setInterval(load, 15_000)
    return () => {
      stop.abort()
      window.clearInterval(id)
    }
  }, [gate, generation])

  const save = (patch: Partial<ReturnType<typeof getSettings>>) => {
    updateSettings(patch)
    if (sessionGate() !== 'in') return
    const current = getSettings()
    staffFetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        outdoorOn: current.outdoorOn,
        outdoorOff: current.outdoorOff,
        outdoorColor: current.outdoorColor,
        glowColor: current.glowColor,
        flashIntervalMin: current.flashMin,
      }),
    })
      .then((response) => {
        if (!response.ok && response.status !== 401) setFault('Settings were not saved.')
        else setFault(null)
      })
      .catch(() => setFault('Settings were not saved.'))
  }

  const press = (name: PiqoAction) => {
    setPending(name)
    staffFetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: name }),
    })
      .then(async (response) => {
        if (response.status === 401) return
        if (!response.ok) throw new Error('no action')
        setFault(null)
        const log = await staffFetch('/api/log?limit=8')
        if (!log.ok) return
        const body = (await log.json()) as { entries?: LogEntry[] }
        if (Array.isArray(body.entries)) setEntries(body.entries)
      })
      .catch(() => setFault('This site has no Piqo connection.'))
      .finally(() => setPending(null))
  }

  const signOut = () => {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(() => undefined)
      .finally(() => markSession('needed'))
  }

  const active = (bookings ?? []).filter((booking) => {
    const start = Date.parse(booking.start)
    const end = Date.parse(booking.end)
    return booking.status !== 'cancelled' && now >= start && now < end
  })
  const busy =
    active.length > 0
      ? active.map((booking) => `${booking.room} · ${booking.name || 'Booking'} · ${booking.people} ${peopleWord(booking.people)}`).join('  ')
      : 'Free · glow stays off unless you turn it on'
  const last = entries[0]
  const told = last
    ? `${last.action} · ${last.sent ? 'sent' : `recorded, not sent · ${last.reason}`}`
    : gate === 'in'
      ? 'Nothing recorded'
      : 'Lights wait for this Mac'
  const flashes = FLASHES.includes(settings.flashMin) ? FLASHES : [settings.flashMin, ...FLASHES]

  return (
    <section className="block" aria-label="Piqo">
      <div className="block-head">
        <h2>Sensor</h2>
        <p>From Piqo · does not change the lights</p>
      </div>
      <div className="piqo-grid">
        <SensorChip
          label="Temperature"
          reading={sensor?.temperature ?? null}
          note={sensorError || sensor?.temperatureNote || 'Reading…'}
          now={now}
          digits={1}
        />
        <SensorChip
          label="Humidity"
          reading={sensor?.humidity ?? null}
          note={sensorError || sensor?.humidityNote || 'Reading…'}
          now={now}
          digits={0}
        />
        <div className="chip">
          <span className="k">CO</span>
          <span className="v">—</span>
          <span className="s">{sensor?.coNote || 'No sensor yet'}</span>
        </div>
      </div>

      <div className="block-head piqo-lights-head">
        <h2>Lights</h2>
        <p>{busy}</p>
      </div>
      <div className="piqo-actions">
        {BUTTONS.map((button) => (
          <button key={button.name} type="button" disabled={pending != null} onClick={() => press(button.name)}>
            {pending === button.name ? 'Sending…' : button.label}
          </button>
        ))}
        {gate === 'in' ? (
          <button type="button" className="piqo-quiet" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </div>
      <div className="piqo-times">
        <label>
          <span>Outdoor on</span>
          <input
            type="time"
            value={settings.outdoorOn}
            aria-label="Outdoor lights on"
            onChange={(event) => {
              if (/^\d{2}:\d{2}$/.test(event.target.value)) save({ outdoorOn: event.target.value })
            }}
          />
        </label>
        <label>
          <span>Outdoor off</span>
          <input
            type="time"
            value={settings.outdoorOff}
            aria-label="Outdoor lights off"
            onChange={(event) => {
              if (/^\d{2}:\d{2}$/.test(event.target.value)) save({ outdoorOff: event.target.value })
            }}
          />
        </label>
        <label>
          <span>Outdoor</span>
          <input
            type="color"
            value={settings.outdoorColor}
            aria-label="Outdoor colour"
            onChange={(event) => save({ outdoorColor: event.target.value })}
          />
        </label>
        <label>
          <span>Glow</span>
          <input
            type="color"
            value={settings.glowColor}
            aria-label="Glow colour"
            onChange={(event) => save({ glowColor: event.target.value })}
          />
        </label>
        <label>
          <span>Flash</span>
          <select
            value={settings.flashMin}
            aria-label="Flash interval minutes"
            onChange={(event) => save({ flashMin: Number(event.target.value) })}
          >
            {flashes.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="piqo-note">
        {fault ? `${fault} ` : ''}
        {told}
        {gate === 'in'
          ? ' Colour is saved on this site. Outdoor on is still the warm-white action.'
          : ' Colour is saved here. Outdoor on is still the warm-white action.'}
      </p>
      {entries.length > 0 ? (
        <ul className="piqo-log">
          {entries.slice(0, 6).map((entry, index) => (
            <li key={`${entry.time}-${entry.action}-${index}`}>
              {entry.action} · {entry.sent ? 'sent' : `recorded, not sent · ${entry.reason}`}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
