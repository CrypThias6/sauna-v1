import { heatHex } from '../lib/heat'
import { formatTemp } from '../lib/format'
import { flueLabel, fluePhase, temperatureSamples } from '../lib/flue'
import { useLiveSensor } from '../lib/sensor'
import { useSettings } from '../lib/settings'
import { useSauna } from '../state/store'
import type { Sauna } from '../types'

function zoneLine(sauna: Sauna) {
  const parts = sauna.cameras
    .map((camera) => {
      const count = sauna.occupants.filter((person) => person.zone === camera.id).length
      return count > 0 ? `${count} ${camera.short}` : null
    })
    .filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' · ') : 'Nobody inside'
}

function ageLabel(recordedAt: string | null, now: number) {
  if (!recordedAt) return ''
  const at = Date.parse(recordedAt)
  if (!Number.isFinite(at)) return ''
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 120) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

export function Controls() {
  const { saunas, index, now, setTarget, toggleDoor, toggleHeater } = useSauna()
  const { safeC } = useSettings()
  const sensor = useLiveSensor()
  const sauna = saunas[index]
  const flue = flueLabel(fluePhase(sauna.heaterOn, sauna.airC, safeC, temperatureSamples(sauna.id)))
  const age = ageLabel(sensor.recordedAt, now)
  const airLine =
    sensor.celsius == null
      ? sensor.error || 'Sensor offline'
      : sensor.offline
        ? `Sensor offline · last updated ${age || 'earlier'}`
        : `Last updated ${age || 'just now'}`

  return (
    <section className="block" id="controls" aria-label="This room">
      <div className="block-head">
        <h2>This room</h2>
        <p>{sauna.name}</p>
      </div>
      <div className="controls">
        <label className="chip air" data-stale={sensor.celsius == null || sensor.offline ? true : undefined}>
          <span className="k">Air</span>
          <span className="v" style={sensor.celsius == null ? undefined : { color: heatHex(sensor.celsius) }}>
            {sensor.celsius == null ? '—' : formatTemp(sensor.celsius)}
            {sensor.celsius == null ? null : <sup>°</sup>}
          </span>
          <span className="s">{airLine}</span>
          <input
            type="range"
            min={40}
            max={100}
            step={1}
            value={Math.round(sauna.targetC)}
            aria-label={`${sauna.name} target temperature`}
            onChange={(event) => setTarget(sauna.id, Number(event.target.value))}
          />
        </label>

        <div className="chip people">
          <span className="k">Scene</span>
          <span className="v">
            {sauna.occupants.length}
            <small>/{sauna.capacity}</small>
          </span>
          <span className="s">{zoneLine(sauna)}</span>
        </div>

        <button type="button" className="chip door" onClick={() => toggleDoor(sauna.id)} data-open={sauna.doorOpen}>
          <span className="k">Door</span>
          <span className="v">{sauna.doorOpen ? 'Open' : 'Shut'}</span>
          <span className="s">{sauna.lock === 'locked' ? 'Locked' : 'Unlocked'}</span>
        </button>

        <button type="button" className="chip heat" onClick={() => toggleHeater(sauna.id)} data-on={sauna.heaterOn}>
          <span className="k">Heater</span>
          <span className="v">
            {Math.round(sauna.heaterPower * 100)}
            <small>%</small>
          </span>
          <span className="s">{flue}</span>
        </button>
      </div>
    </section>
  )
}
