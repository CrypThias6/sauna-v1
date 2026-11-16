import { useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { visitsOn } from '../data/bookings'
import { bookingVersion, subscribeBookings } from '../data/simplybook'
import { peopleWord } from '../lib/format'
import type { PiqoAction } from '../lib/lights'
import { updateSettings, useSettings } from '../lib/settings'
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

type VisitLine = {
  id: string
  room: string
  name: string
  people: number
  time: string
  minutes: number
}

type Status = {
  glow: 'on' | 'off' | null
  outdoor: 'on' | 'off' | null
  active: VisitLine[]
  last: { name: string; at: number; source: string; sent: boolean; error: string }[]
  note: string
}

const BUTTONS: { name: PiqoAction; label: string }[] = [
  { name: 'Glow on', label: 'Glow on' },
  { name: 'Glow off', label: 'Glow off' },
  { name: 'Outdoor on', label: 'Outdoor on' },
  { name: 'Outdoor off', label: 'Outdoor off' },
  { name: 'Warning flash', label: 'Warning flash' },
]

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

function dayStamp(now: number) {
  const date = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
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
    <div className="chip" data-stale={old}>
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
  const book = useSyncExternalStore(subscribeBookings, bookingVersion, bookingVersion)
  const [sensor, setSensor] = useState<Sensor | null>(null)
  const [sensorError, setSensorError] = useState<string | null>(null)
  const [lights, setLights] = useState<Status | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [fault, setFault] = useState<string | null>(null)
  const minute = Math.floor(now / 60_000)

  useEffect(() => {
    const stop = new AbortController()
    const load = () => {
      fetch('/piqo/sensor', { signal: stop.signal })
        .then((response) => {
          if (!response.ok) throw new Error('no sensor')
          return response.json() as Promise<Sensor>
        })
        .then((body) => {
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
  }, [])

  useEffect(() => {
    const date = new Date(minute * 60_000)
    const visits = visitsOn(date.getFullYear(), date.getMonth(), date.getDate())
    const stop = new AbortController()
    fetch('/piqo/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        day: dayStamp(date.getTime()),
        visits,
        outdoorOn: settings.outdoorOn,
        outdoorOff: settings.outdoorOff,
      }),
      signal: stop.signal,
    })
      .then((response) => (response.ok ? (response.json() as Promise<Status>) : null))
      .then((body) => {
        if (body) setLights(body)
      })
      .catch(() => {
        /* Status stays as last seen. The public site has no Piqo process. */
      })
    return () => stop.abort()
  }, [book, minute, settings.outdoorOff, settings.outdoorOn])

  useEffect(() => {
    const stop = new AbortController()
    const load = () => {
      fetch('/piqo/status', { signal: stop.signal })
        .then((response) => (response.ok ? (response.json() as Promise<Status>) : null))
        .then((body) => {
          if (body) setLights(body)
        })
        .catch(() => undefined)
    }
    const id = window.setInterval(load, 10_000)
    return () => {
      stop.abort()
      window.clearInterval(id)
    }
  }, [])

  const press = (name: PiqoAction) => {
    setPending(name)
    fetch('/piqo/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then((response) => response.json() as Promise<{ error?: string; status?: Status }>)
      .then((body) => {
        if (body.status) setLights(body.status)
        setFault(null)
      })
      .catch(() => setFault('This site has no Piqo connection.'))
      .finally(() => setPending(null))
  }

  const busy =
    lights && lights.active.length > 0
      ? lights.active
          .map((visit) => `${visit.room} · ${visit.name} · ${visit.people} ${peopleWord(visit.people)}`)
          .join('  ')
      : 'Free · glow stays off unless you turn it on'
  const last = lights?.last[0]
  const told = last
    ? `${last.name} · not sent`
    : lights
      ? 'Nothing sent'
      : 'Lights wait for this Mac'

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
          <button
            key={button.name}
            type="button"
            disabled={pending != null}
            onClick={() => press(button.name)}
          >
            {pending === button.name ? 'Sending…' : button.label}
          </button>
        ))}
      </div>
      <div className="piqo-times">
        <label>
          <span>Outdoor on</span>
          <input
            type="time"
            value={settings.outdoorOn}
            aria-label="Outdoor lights on"
            onChange={(event) => {
              if (/^\d{2}:\d{2}$/.test(event.target.value)) updateSettings({ outdoorOn: event.target.value })
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
              if (/^\d{2}:\d{2}$/.test(event.target.value)) updateSettings({ outdoorOff: event.target.value })
            }}
          />
        </label>
        <label>
          <span>Colour</span>
          <input
            type="color"
            value={settings.outdoorColor}
            aria-label="Outdoor colour"
            onChange={(event) => updateSettings({ outdoorColor: event.target.value })}
          />
        </label>
      </div>
      <p className="piqo-note">
        {fault ? `${fault} ` : ''}
        {told}
        {lights?.note ? ` · ${lights.note}` : ''} Colour is saved here. Outdoor on is still the warm-white action.
        {lights?.glow ? ` Glow should be ${lights.glow}.` : ''}
        {lights?.outdoor ? ` Outdoor should be ${lights.outdoor}.` : ''}
      </p>
    </section>
  )
}
