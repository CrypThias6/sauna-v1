import { useCallback, useEffect, useRef } from 'react'
import type { Bridge } from '../scene/bridge'
import { attachGestures } from '../scene/gestures'
import { Viewport } from '../scene/viewport'
import { arriveAtBig, cancelVisit } from '../scene/visit'
import { ViewError } from './view-error'
import { TopActions } from './panels'
import { useSauna } from '../state/store'

export function Stage({
  bridge,
  onAi,
  onSettings,
}: {
  bridge: Bridge
  onAi: () => void
  onSettings: () => void
}) {
  const viewRef = useRef<HTMLDivElement>(null)
  const {
    saunas,
    index,
    setIndex,
    cameraId,
    setDoor,
    removeOccupant,
    addOccupant,
    toggleDoor,
    toggleLights,
  } = useSauna()
  const saunasRef = useRef(saunas)
  saunasRef.current = saunas
  const visitApi = useRef({ setDoor, removeOccupant, addOccupant })
  visitApi.current = { setDoor, removeOccupant, addOccupant }
  const prevIndex = useRef(index)
  const sauna = saunas[index]
  const previous = index > 0 ? saunas[index - 1] : null
  const next = index < saunas.length - 1 ? saunas[index + 1] : null

  const go = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(saunas.length - 1, nextIndex))
      bridge.index = clamped
      bridge.drag = 0
      setIndex(clamped)
    },
    [bridge, saunas.length, setIndex],
  )

  useEffect(() => {
    bridge.count = saunas.length
  }, [bridge, saunas.length])

  useEffect(() => {
    bridge.index = index
    if (prevIndex.current === index) return
    const from = prevIndex.current
    prevIndex.current = index
    bridge.drag = 0
    if (index === 1 && from !== 1) {
      const big = saunasRef.current.find((room) => room.id === 'big')
      if (big) arriveAtBig(big, visitApi.current)
    } else {
      cancelVisit()
    }
  }, [bridge, index])

  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    return attachGestures(el, bridge, go)
  }, [bridge, go])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (cameraId) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Arrow keys inside the sheet browse the page, not the rooms.
      if (target?.closest('.sheet, .overlay')) return
      if (event.key === 'ArrowRight') go(index + 1)
      if (event.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cameraId, go, index])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__sauna = {
      go,
      toggleDoor: () => toggleDoor(saunas[bridge.index]?.id ?? sauna.id),
      toggleLights: () => toggleLights(saunas[bridge.index]?.id ?? sauna.id),
      aim: (x: number, y: number, z: number) => {
        bridge.camera?.position.set(x, y, z)
      },
      snapshot: () => ({
        index: bridge.index,
        camera: bridge.camera
          ? {
              x: bridge.camera.position.x,
              y: bridge.camera.position.y,
              z: bridge.camera.position.z,
            }
          : null,
        targetX: bridge.controls?.target.x ?? null,
        rooms: saunas.map((room) => ({
          id: room.id,
          name: room.name,
          air: room.airC,
          door: room.doorOpen,
          lock: room.lock,
          people: room.occupants.length,
          lightsOn: room.lights.filter((light) => light.on).length,
          heaterOn: room.heaterOn,
        })),
      }),
    }
  })

  return (
    <section className="hero" aria-label={`${sauna.name} sauna`}>
      <div className="stage-view">
        <div className="viewport" ref={viewRef}>
          <ViewError>
            <Viewport saunas={saunas} bridge={bridge} />
          </ViewError>
        </div>
        <button
          type="button"
          className="nav prev"
          aria-label={previous ? `Show ${previous.name}` : 'Previous sauna'}
          disabled={!previous}
          onClick={() => go(index - 1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          className="nav next"
          aria-label={next ? `Show ${next.name}` : 'Next sauna'}
          disabled={!next}
          onClick={() => go(index + 1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <TopActions onAi={onAi} onSettings={onSettings} />
    </section>
  )
}
