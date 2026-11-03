import { useSauna } from '../state/store'

function Cell({
  k,
  value,
  sub,
  tone,
  onClick,
  label,
}: {
  k: string
  value: string
  sub?: string
  tone?: 'warn' | 'hot' | 'ok'
  onClick?: () => void
  label?: string
}) {
  if (onClick) {
    return (
      <button type="button" className="cell" data-tone={tone} onClick={onClick} aria-label={label ?? k}>
        <span className="k">{k}</span>
        <strong>{value}</strong>
        {sub && <span className="s">{sub}</span>}
      </button>
    )
  }
  return (
    <div className="cell" data-tone={tone}>
      <span className="k">{k}</span>
      <strong>{value}</strong>
      {sub && <span className="s">{sub}</span>}
    </div>
  )
}

export function Telemetry() {
  const { saunas, index, toggleLock, toggleLights } = useSauna()
  const sauna = saunas[index]
  const lightsOn = sauna.lights.filter((light) => light.on).length
  const sessionValue = !sauna.session.active
    ? sauna.session.mode
    : sauna.session.endsInMin <= 0
      ? 'Ending'
      : `${Math.ceil(sauna.session.endsInMin)} min`

  return (
    <section className="block" aria-label="Right now">
      <div className="block-head">
        <h2>Right now</h2>
        <p>{sauna.name}</p>
      </div>
      <div className="telemetry">
        <Cell k="Humidity" value={`${Math.round(sauna.humidity)}%`} sub="Air" />
        <Cell k="Bench" value={`${sauna.benchC.toFixed(1)}°`} sub="Surface" tone="hot" />
        <Cell k="CO₂" value={`${sauna.co2}`} sub="ppm" />
        <Cell
          k="Lights"
          value={`${lightsOn} of ${sauna.lights.length}`}
          sub={lightsOn > 0 ? 'On' : 'Off'}
          onClick={() => toggleLights(sauna.id)}
          label={`${sauna.name} lights, ${lightsOn} of ${sauna.lights.length} on. Toggle.`}
        />
        <Cell
          k="Lock"
          value={sauna.lock === 'locked' ? 'Locked' : 'Open'}
          sub={sauna.doorOpen ? 'Door is open' : 'Door is shut'}
          onClick={() => toggleLock(sauna.id)}
          label={`${sauna.name} lock, ${sauna.lock}. Toggle.`}
        />
        <Cell
          k="Session"
          value={sessionValue}
          sub={sauna.session.active ? sauna.session.mode : 'Not in a booking'}
        />
        <Cell k="Draw" value={`${sauna.energyKw.toFixed(1)} kW`} sub={sauna.heaterOn ? 'Heater live' : 'Heater off'} />
        <Cell
          k="Water"
          value={sauna.water === 'low' ? 'Low' : 'Ok'}
          sub="Reservoir"
          tone={sauna.water === 'low' ? 'warn' : 'ok'}
        />
      </div>
    </section>
  )
}
