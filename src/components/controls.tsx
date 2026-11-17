import { heatHex } from '../lib/heat'
import { formatTemp } from '../lib/format'
import { flueLabel, fluePhase, temperatureSamples } from '../lib/flue'
import { useLiveSensor } from '../lib/sensor'
import { sensorLink } from '../lib/sensor-status'
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
  const humidAge = ageLabel(sensor.humidity?.recordedAt ?? null, now)
  const link = sensor.known ? sensorLink({ now, heardAt: sensor.heardAt, reachable: sensor.reachable }) : null
  const heard = ageLabel(sensor.heardAt, now)
  const badge =
    link === 'online'
      ? 'Sensor online'
      : link === 'offline'
        ? heard
          ? `Sensor offline · last heard ${heard}`
          : 'Sensor offline'
        : link === 'unreachable'
          ? "Can't reach Piqo"
          : ''
  const airLine =
    sensor.celsius == null
      ? sensor.error || 'Sensor offline'
      : link === 'offline'
        ? `Sensor offline · last updated ${age || 'earlier'}`
        : `Last updated ${age || 'just now'}`
  const humidLine =
    sensor.humidityPercent == null
      ? sensor.humidityError || 'No humidity reading.'
      : link === 'offline'
        ? `Sensor offline · updated ${humidAge || 'earlier'}`
        : `updated ${humidAge || 'just now'}`

  return (
    <section className="block" id="controls" aria-label="This room">
      <div className="block-head">
        <h2>This room</h2>
        <p>{sauna.name}</p>
      </div>
      {badge ? (
        <p className="sensor-badge" data-link={link ?? undefined}>
          {badge}
        </p>
      ) : null}
      <div className="controls">
        <label className="chip air" data-stale={sensor.celsius == null || link !== 'online' ? true : undefined}>
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
            aria-label={`${sauna.name} scene target`}
            onChange={(event) => setTarget(sauna.id, Number(event.target.value))}
          />
        </label>

        <div className="chip" data-stale={sensor.humidityPercent == null || link !== 'online' ? true : undefined}>
          <span className="k">Humidity</span>
          <span className="v">
            {sensor.humidityPercent == null ? '—' : Math.round(sensor.humidityPercent)}
            {sensor.humidityPercent == null ? null : <small>%</small>}
          </span>
          <span className="s">{humidLine}</span>
        </div>

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
