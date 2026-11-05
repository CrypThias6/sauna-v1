import { roomChecks, type Check } from '../lib/checks'
import { useSettings } from '../lib/settings'
import { useSauna } from '../state/store'

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className="mark" aria-hidden="true">
      {ok ? (
        <svg viewBox="0 0 16 16" width="12" height="12">
          <path d="M3.2 8.3l3.1 3.1 6.5-6.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="11" height="11">
          <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

function Row({ check, onPress }: { check: Check; onPress?: () => void }) {
  const text = (
    <>
      <Mark ok={check.ok} />
      <span className="check-k">{check.label}</span>
      <span className="check-v">{check.value}</span>
    </>
  )
  if (!onPress) {
    return (
      <div className="check" data-ok={check.ok} aria-label={`${check.ok ? 'Ok' : 'Needs a look'}. ${check.label}. ${check.value}`}>
        {text}
      </div>
    )
  }
  return (
    <button type="button" className="check" data-ok={check.ok} onClick={onPress} aria-label={`${check.ok ? 'Ok' : 'Needs a look'}. ${check.label}. ${check.value}`}>
      {text}
    </button>
  )
}

export function Telemetry() {
  const { saunas, index, now, toggleLock, toggleHeater, toggleLights } = useSauna()
  const settings = useSettings()
  const sauna = saunas[index]
  const checks = roomChecks(sauna, settings, now)
  const press: Record<string, (() => void) | undefined> = {
    lock: () => toggleLock(sauna.id),
    heater: () => toggleHeater(sauna.id),
    lights: () => toggleLights(sauna.id),
  }

  return (
    <section className="block" aria-label="Checklist">
      <div className="block-head">
        <h2>Right now</h2>
        <p>{sauna.name}</p>
      </div>
      <ul className="checks">
        {checks.map((check) => (
          <li key={check.id}>
            <Row
              check={check}
              onPress={check.action ? press[check.action] : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
