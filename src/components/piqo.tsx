import { useState, useSyncExternalStore } from 'react'
import { useSauna } from '../state/store'
import type { PiqoAction } from '../lib/lights'
import { setOutdoorHold, shownOutdoor, useOutdoorHold } from '../lib/light-panel'
import { getSettings, updateSettings, useSettings } from '../lib/settings'
import { markSession, sessionGate, staffFetch, subscribeSession } from '../lib/session'

export function Piqo() {
  const { now } = useSauna()
  const settings = useSettings()
  const gate = useSyncExternalStore(subscribeSession, sessionGate, () => 'unknown' as const)
  const hold = useOutdoorHold()
  const outdoor = shownOutdoor(new Date(now), settings.outdoorOn, settings.outdoorOff, hold)
  const [indoor, setIndoor] = useState<'on' | 'off'>('off')
  const [pending, setPending] = useState<null | 'indoor' | 'outdoor'>(null)
  const [fault, setFault] = useState<string | null>(null)

  const saveTime = (patch: { outdoorOn?: string; outdoorOff?: string }) => {
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
    }).catch(() => setFault('The times were not saved.'))
  }

  const toggle = (which: 'indoor' | 'outdoor') => {
    const on = which === 'indoor' ? indoor === 'on' : outdoor === 'on'
    const action: PiqoAction = which === 'indoor' ? (on ? 'Glow off' : 'Glow on') : on ? 'Outdoor off' : 'Outdoor on'
    setPending(which)
    setFault(null)
    staffFetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
      .then(async (response) => {
        if (response.status === 401) return
        const body = (await response.json().catch(() => null)) as { ok?: boolean; reason?: string } | null
        if (!response.ok || body?.ok === false) {
          setFault(body?.reason === 'too soon' ? 'Wait a moment, then try again.' : 'The lights did not change. Try again.')
          return
        }
        const next = on ? 'off' : 'on'
        if (which === 'indoor') setIndoor(next)
        else setOutdoorHold(next, new Date(now), settings.outdoorOn, settings.outdoorOff)
      })
      .catch(() => setFault('The lights did not change. Try again.'))
      .finally(() => setPending(null))
  }

  return (
    <section className="block" aria-label="Lights">
      <div className="block-head">
        <h2>Lights</h2>
        {gate === 'in' ? (
          <button type="button" className="piqo-quiet" onClick={() => {
            fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => markSession('needed'))
          }}>
            Sign out
          </button>
        ) : null}
      </div>
      <div className="light-row">
        <button type="button" className="light-toggle" data-on={indoor === 'on'} disabled={pending != null} onClick={() => toggle('indoor')}>
          {pending === 'indoor' ? <span className="spin" aria-hidden="true" /> : <span className="bulb" data-on={indoor === 'on'} aria-hidden="true" />}
          <span>
            <strong>Indoor</strong>
            <small>{indoor === 'on' ? 'On' : 'Off'}</small>
          </span>
        </button>
        <button type="button" className="light-toggle" data-on={outdoor === 'on'} disabled={pending != null} onClick={() => toggle('outdoor')}>
          {pending === 'outdoor' ? <span className="spin" aria-hidden="true" /> : <span className="bulb outdoor" data-on={outdoor === 'on'} aria-hidden="true" />}
          <span>
            <strong>Outdoor</strong>
            <small>{outdoor === 'on' ? 'On' : 'Off'}</small>
          </span>
        </button>
      </div>
      {fault ? <p className="piqo-note">{fault}</p> : null}
      <div className="piqo-times">
        <label>
          <span>Outdoor on</span>
          <input
            type="time"
            value={settings.outdoorOn}
            aria-label="Outdoor lights on"
            onChange={(event) => {
              if (/^\d{2}:\d{2}$/.test(event.target.value)) saveTime({ outdoorOn: event.target.value })
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
              if (/^\d{2}:\d{2}$/.test(event.target.value)) saveTime({ outdoorOff: event.target.value })
            }}
          />
        </label>
      </div>
    </section>
  )
}
