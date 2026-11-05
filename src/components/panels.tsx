import { useEffect, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { roomChecks } from '../lib/checks'
import { fluePhase, temperatureSamples, type Flue } from '../lib/flue'
import { getSettings, updateSettings, useSettings, type Settings } from '../lib/settings'
import { bridgeListening, subscribeBridge } from '../mcp/link'
import { getVisit } from '../scene/visit'
import { useSauna } from '../state/store'

function Spark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 3.2l1.3 5.2L18.6 10l-5.3 1.5L12 16.8l-1.3-5.3L5.4 10l5.3-1.6L12 3.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Sliders() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M4 8h9M4 16h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 8h4M13 16h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="15" cy="8" r="1.7" fill="currentColor" />
      <circle cx="11.5" cy="16" r="1.7" fill="currentColor" />
    </svg>
  )
}

function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M9.15 2.7h5.7l.45 2.15 1.7.7 1.7-1.35 3.15 3.15-1.35 1.7.7 1.7 2.15.45v5.7l-2.15.45-.7 1.7 1.35 1.7-3.15 3.15-1.7-1.35-1.7.7-.45 2.15h-5.7l-.45-2.15-1.7-.7-1.7 1.35L3.3 18.9l1.35-1.7-.7-1.7L1.8 14.05v-5.7l2.15-.45.7-1.7L3.3 4.2l3.15-3.15 1.7 1.35 1.7-.7.45-2.15zM12 9.15a2.85 2.85 0 1 0 0 5.7 2.85 2.85 0 0 0 0-5.7z"
      />
    </svg>
  )
}

function glideToControls() {
  const el = document.getElementById('controls')
  const scroller = document.scrollingElement
  if (!el || !scroller) return
  const top = Math.max(0, el.getBoundingClientRect().top + scroller.scrollTop - 22)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scroller.scrollTo(0, top)
    return
  }
  const start = scroller.scrollTop
  const change = top - start
  const duration = 720
  const t0 = performance.now()
  const tick = (now: number) => {
    const u = Math.min(1, (now - t0) / duration)
    const eased = 1 - (1 - u) ** 3
    scroller.scrollTo(0, start + change * eased)
    if (u < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function TopActions({ onAi, onSettings }: { onAi: () => void; onSettings: () => void }) {
  return (
    <div className="top-actions">
      <div className="top-cluster">
        <button type="button" className="icon-btn" aria-label="AI" onClick={onAi}>
          <Spark />
        </button>
        <button type="button" className="icon-btn" aria-label="Control panel" onClick={glideToControls}>
          <Sliders />
        </button>
      </div>
      <button type="button" className="icon-btn" aria-label="Settings" onClick={onSettings}>
        <Gear />
      </button>
    </div>
  )
}

function Toggle({
  setting,
  label,
  quiet = false,
}: {
  setting: keyof Pick<
    Settings,
    'door' | 'heat' | 'water' | 'session' | 'doorLockedSession' | 'doorOpenIdle' | 'leftOn' | 'co2On'
  >
  label: string
  quiet?: boolean
}) {
  const settings = useSettings()
  const on = settings[setting]
  return (
    <button
      type="button"
      className={quiet ? 'toggle quiet' : 'toggle'}
      aria-pressed={on}
      onClick={() => updateSettings({ [setting]: !on })}
    >
      <span>{label}</span>
      <i />
    </button>
  )
}

function NumberRule({
  label,
  setting,
  min,
  max,
  unit,
}: {
  label: string
  setting: keyof Pick<Settings, 'underBy' | 'tooHot' | 'co2Max' | 'leadMin'>
  min: number
  max: number
  unit: string
}) {
  const settings = useSettings()
  const saved = settings[setting]
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="rule">
      <span>{label}</span>
      <span className="rule-value">
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          inputMode="numeric"
          value={draft ?? String(saved)}
          aria-label={label}
          onFocus={() => setDraft(String(saved))}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = Number(draft)
            updateSettings({
              [setting]: Number.isFinite(next) ? Math.min(max, Math.max(min, Math.round(next))) : saved,
            })
            setDraft(null)
          }}
        />
        <span>{unit}</span>
      </span>
    </label>
  )
}

function SafeField() {
  const settings = useSettings()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="safe">
      <input
        type="number"
        min={20}
        max={80}
        step={1}
        inputMode="numeric"
        value={draft ?? String(settings.safeC)}
        aria-label="Safe to leave temperature"
        onFocus={() => setDraft(String(settings.safeC))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft)
          updateSettings({
            safeC: Number.isFinite(next) ? Math.min(80, Math.max(20, Math.round(next))) : settings.safeC,
          })
          setDraft(null)
        }}
      />
      <span>°</span>
    </label>
  )
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [alertsOpen, setAlertsOpen] = useState(false)
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="panel-head">
          <h2>Settings</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <button
          type="button"
          className="disclose"
          aria-expanded={alertsOpen}
          onClick={() => setAlertsOpen((open) => !open)}
        >
          <span>
            Alerts
            {!alertsOpen && <small>Door, heat, water, session</small>}
          </span>
          <i />
        </button>
        {alertsOpen && (
          <div className="toggles">
            <Toggle setting="door" label="Door" />
            <Toggle setting="doorLockedSession" label="Locked while a session is on" quiet />
            <Toggle setting="doorOpenIdle" label="Open when nothing is booked" quiet />
            <Toggle setting="heat" label="Heat" />
            <NumberRule label="Under target by" setting="underBy" min={1} max={30} unit="°" />
            <NumberRule label="Too hot above" setting="tooHot" min={60} max={110} unit="°" />
            <Toggle setting="leftOn" label="Heater or lights left on in an empty room" quiet />
            <Toggle setting="water" label="Water" />
            <Toggle setting="session" label="Session" />
            <NumberRule label="Show a booking this far ahead" setting="leadMin" min={5} max={120} unit="min" />
            <Toggle setting="co2On" label="CO₂" />
            <NumberRule label="High above" setting="co2Max" min={600} max={5000} unit="ppm" />
          </div>
        )}
        <p className="panel-k">Safe to leave</p>
        <SafeField />
        <p className="panel-k">Account</p>
        <input
          className="account"
          value={settings.name}
          placeholder="Name"
          aria-label="Name"
          onChange={(event) => updateSettings({ name: event.target.value })}
        />
      </div>
    </div>
  )
}

export function ConnectPanel({ onClose }: { onClose: () => void }) {
  const listening = useSyncExternalStore(subscribeBridge, bridgeListening, () => false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/mcp`
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  const copy = () => {
    const mark = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    }
    const fallback = () => {
      const field = linkRef.current
      if (!field) return
      field.focus()
      field.select()
      try {
        if (document.execCommand('copy')) mark()
      } catch {
        /* The address stays selected so it can be copied by hand. */
      }
    }
    const clip = navigator.clipboard?.writeText?.(url)
    if (!clip) {
      fallback()
      return
    }
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      fallback()
    }, 400)
    void clip.then(
      () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        mark()
      },
      () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        fallback()
      },
    )
  }
  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="MCP">
        <header className="panel-head">
          <h2>MCP</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="mcp-row">
          <span className="live" data-on={listening} aria-label={listening ? 'Listening' : 'Not connected'} />
          <input ref={linkRef} readOnly value={url} aria-label="MCP link" onFocus={(event) => event.target.select()} />
          <button type="button" className="copy" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mcp-line">Heat, door, people, calendar.</p>
      </div>
    </div>
  )
}

export function Toasts() {
  const { saunas } = useSauna()
  const settings = useSettings()
  const { safeC } = settings
  const [note, setNote] = useState<string | null>(null)
  const prev = useRef<Map<string, string> | null>(null)
  const prevFlue = useRef<Map<string, Flue> | null>(null)
  const prevWatch = useRef<Map<string, string> | null>(null)
  const prevSettings = useRef(settings)

  useEffect(() => {
    const settingsChanged = prevSettings.current !== settings
    prevSettings.current = settings
    const next = new Map(
      saunas.map((sauna) => [
        sauna.id,
        [
          sauna.doorOpen ? 'open' : 'shut',
          sauna.heaterOn ? 'heat' : 'off',
          sauna.water,
          sauna.session.active ? 'on' : 'off',
          sauna.session.endsInMin <= 0 ? 'ended' : 'running',
        ].join(':'),
      ]),
    )
    const phases = new Map(
      saunas.map((sauna) => [
        sauna.id,
        fluePhase(sauna.heaterOn, sauna.airC, safeC, temperatureSamples(sauna.id)),
      ] as const),
    )
    const prior = prev.current
    const priorFlue = prevFlue.current
    prev.current = next
    prevFlue.current = phases
    const settingsNow = getSettings()
    const watch = new Map<string, string>()
    for (const sauna of saunas) {
      for (const check of roomChecks(sauna, settingsNow, Date.now())) {
        if (!check.watch || !check.alert || check.watch.endsWith(':low')) continue
        watch.set(`${sauna.id}:${check.watch}`, `${sauna.name} · ${check.alert}`)
      }
    }
    const priorWatch = prevWatch.current
    prevWatch.current = watch
    let line: string | null = null
    if (priorFlue && settingsNow.heat && !settingsChanged) {
      for (const sauna of saunas) {
        if (priorFlue.get(sauna.id) !== 'safe' && phases.get(sauna.id) === 'safe') {
          line = `${sauna.name} · Safe to leave`
          break
        }
      }
    }
    if (!line && prior && !settingsChanged && !getVisit()) {
      for (const sauna of saunas) {
        const was = prior.get(sauna.id)
        if (!was) continue
        const [door, heat, water, session, ended] = was.split(':')
        if (settingsNow.door && door !== (sauna.doorOpen ? 'open' : 'shut')) {
          line = `${sauna.name} · ${sauna.doorOpen ? 'Door opened' : 'Door shut'}`
        } else if (settingsNow.heat && heat !== (sauna.heaterOn ? 'heat' : 'off')) {
          line = `${sauna.name} · ${sauna.heaterOn ? 'Heater on' : 'Heater off'}`
        } else if (settingsNow.water && water !== 'low' && sauna.water === 'low') {
          line = `${sauna.name} · Water low`
        } else if (settingsNow.session && session === 'on' && ended === 'running' && sauna.session.endsInMin <= 0) {
          line = `${sauna.name} · Session ending`
        }
        if (line) break
      }
      if (!line && priorWatch) {
        for (const [key, text] of watch) {
          if (!priorWatch.has(key)) {
            line = text
            break
          }
        }
      }
    }
    if (line) setNote(line)
  }, [saunas, settings, safeC])

  useEffect(() => {
    if (!note) return
    const id = window.setTimeout(() => setNote(null), 2600)
    return () => window.clearTimeout(id)
  }, [note])

  if (!note) return null
  return (
    <div className="toast" role="status">
      {note}
    </div>
  )
}
