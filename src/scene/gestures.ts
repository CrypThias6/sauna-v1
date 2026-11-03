import { ROOM_SPACING } from './space'
import type { Bridge } from './bridge'

/**
 * Touch: a mostly-horizontal drag changes rooms. Anything else is left to
 * OrbitControls, which is the only orbit implementation.
 * Trackpad: a horizontal wheel also changes rooms.
 */
export function attachGestures(el: HTMLElement, bridge: Bridge, commit: (index: number) => void) {
  let start: { x: number; y: number; t: number } | null = null
  let mode: 'undecided' | 'swipe' | 'orbit' = 'undecided'
  let lastX = 0
  let lastT = 0
  let velocityX = 0

  const restore = () => {
    const saved = bridge.saved
    if (!saved || !bridge.camera || !bridge.controls) return
    bridge.camera.position.copy(saved.cam)
    bridge.controls.target.copy(saved.target)
    bridge.controls.update()
  }

  const endSwipe = (dx: number) => {
    const width = el.clientWidth || 1
    const flicked = Math.abs(dx) > Math.min(96, width * 0.18) || Math.abs(velocityX) > 0.55
    let next = bridge.index
    if (flicked && dx < 0 && bridge.index < bridge.count - 1) next += 1
    if (flicked && dx > 0 && bridge.index > 0) next -= 1
    bridge.drag = 0
    if (bridge.controls) bridge.controls.enabled = true
    commit(next)
  }

  const onMove = (event: PointerEvent) => {
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const now = performance.now()
    const dt = now - lastT
    if (dt > 0) velocityX = (event.clientX - lastX) / dt
    lastX = event.clientX
    lastT = now

    if (mode === 'undecided') {
      if (Math.hypot(dx, dy) < 12) return
      if (Math.abs(dx) > Math.abs(dy) * 1.35) {
        mode = 'swipe'
        if (bridge.controls) bridge.controls.enabled = false
        restore()
      } else {
        mode = 'orbit'
      }
    }

    if (mode !== 'swipe') return
    const width = el.clientWidth || 1
    let world = -(dx / width) * ROOM_SPACING
    const pullingPrevious = bridge.index === 0 && world < 0
    const pullingNext = bridge.index === bridge.count - 1 && world > 0
    if (pullingPrevious || pullingNext) world *= 0.3
    bridge.drag = world
  }

  const onUp = (event: PointerEvent) => {
    if (!start) return
    const dx = event.clientX - start.x
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onUp, true)
    if (mode === 'swipe') endSwipe(dx)
    start = null
    mode = 'undecided'
    bridge.saved = null
  }

  const onDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return
    const target = event.target
    if (target instanceof Element && target.closest('button, input, a')) return
    start = { x: event.clientX, y: event.clientY, t: performance.now() }
    lastX = event.clientX
    lastT = start.t
    velocityX = 0
    mode = 'undecided'
    if (bridge.camera && bridge.controls) {
      bridge.saved = {
        cam: bridge.camera.position.clone(),
        target: bridge.controls.target.clone(),
      }
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
  }

  let wheelAccum = 0
  let wheelTimer = 0
  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 8) return
    event.preventDefault()
    wheelAccum += event.deltaX
    window.clearTimeout(wheelTimer)
    wheelTimer = window.setTimeout(() => {
      if (wheelAccum > 24) commit(bridge.index + 1)
      else if (wheelAccum < -24) commit(bridge.index - 1)
      wheelAccum = 0
    }, 60)
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('wheel', onWheel, { passive: false })

  return () => {
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('wheel', onWheel)
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onUp, true)
    window.clearTimeout(wheelTimer)
  }
}
