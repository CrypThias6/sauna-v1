import { useEffect, useRef, useState } from 'react'
import { heatHex } from '../lib/heat'
import { RemoteLink } from '../mcp/link'
import { useSauna } from '../state/store'
import type { Bridge } from '../scene/bridge'
import { Stage } from './stage'
import { Calendar } from './calendar'
import { Controls } from './controls'
import { Cameras } from './cameras'
import { Telemetry } from './telemetry'
import { ConnectPanel, SettingsPanel, Toasts } from './panels'

export function Shell() {
  const { saunas, index } = useSauna()
  const sauna = saunas[index]
  const [panel, setPanel] = useState<null | 'settings' | 'connect'>(null)
  const bridge = useRef<Bridge>({
    index: 0,
    drag: 0,
    count: saunas.length,
    controls: null,
    camera: null,
    saved: null,
  })

  useEffect(() => {
    document.title = `${sauna.name} — Sauna`
  }, [sauna.name])

  useEffect(() => {
    if (!panel) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  return (
    <div className="app" style={{ ['--heat' as string]: heatHex(sauna.airC) }}>
      <RemoteLink />
      <Toasts />
      <div className="deck">
        <Stage
          bridge={bridge.current}
          onAi={() => setPanel('connect')}
          onSettings={() => setPanel('settings')}
        />
        <div className="sheet">
          <div className="sheet-grab" aria-hidden="true" />
          <div className="sheet-inner">
            <Calendar />
            <Controls />
            <Telemetry />
            <Cameras />
          </div>
        </div>
      </div>
      {panel === 'settings' && <SettingsPanel onClose={() => setPanel(null)} />}
      {panel === 'connect' && <ConnectPanel onClose={() => setPanel(null)} />}
    </div>
  )
}
