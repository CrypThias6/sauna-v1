import { heatHex } from '../lib/heat'
import { formatTemp } from '../lib/format'
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

export function Controls() {
  const { saunas, index, setTarget, toggleDoor, toggleHeater } = useSauna()
  const sauna = saunas[index]

  return (
    <section className="block" id="controls" aria-label="This room">
      <div className="block-head">
        <h2>This room</h2>
        <p>{sauna.name}</p>
      </div>
      <div className="controls">
        <label className="chip air">
          <span className="k">Air</span>
          <span className="v" style={{ color: heatHex(sauna.airC) }}>
            {formatTemp(sauna.airC)}
            <sup>°</sup>
          </span>
          <span className="s">Target {Math.round(sauna.targetC)}°</span>
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
          <span className="k">In room</span>
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
          <span className="s">{sauna.heaterOn ? 'Heating' : 'Off'}</span>
        </button>
      </div>
    </section>
  )
}
