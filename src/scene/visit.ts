import type { Occupant, Sauna, Slot } from '../types'

export type VisitKind = 'out' | 'in'

export type Visit = {
  roomId: string
  kind: VisitKind
  personId: string
  color: string
  from: [number, number, number]
  via: [number, number, number]
  to: [number, number, number]
  slotId: string
  zone: string
  t0: number
  done: number
}

type VisitApi = {
  setDoor: (id: string, open: boolean) => void
  removeOccupant: (id: string, personId: string) => void
  addOccupant: (id: string, person: Occupant) => void
}

const listeners = new Set<() => void>()
let visit: Visit | null = null
let timers: number[] = []
let arrivals = 0
let nextKind: VisitKind = 'out'

/**
 * Door face is about z = 1.95. The open door swings toward the camera on the
 * hinge's left, so the visitor stands further left, off the barrel, where the
 * black background is. Measured: this spot projects clear of the wood.
 */
const THRESHOLD: [number, number, number] = [-0.7, 0, 2.5]
const OUTSIDE: [number, number, number] = [-1.35, 0, 2.4]

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribeVisit(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVisit() {
  return visit
}

/** Person hidden from the bench while they walk out. */
export function hiddenId() {
  return visit?.kind === 'out' ? visit.personId : null
}

export function walkPoint(current: Visit, now: number): [number, number, number] {
  const elapsed = (now - current.t0) / 1000
  const start = current.kind === 'in' ? 0.7 : 0.4
  const end = current.kind === 'in' ? 2.5 : 2.3
  const raw = (elapsed - start) / (end - start)
  const u = Math.min(1, Math.max(0, raw))
  const eased = u * u * (3 - 2 * u)
  const from = eased < 0.42 ? current.from : current.via
  const to = eased < 0.42 ? current.via : current.to
  const span = eased < 0.42 ? eased / 0.42 : (eased - 0.42) / 0.58
  return [
    from[0] + (to[0] - from[0]) * span,
    from[1] + (to[1] - from[1]) * span,
    from[2] + (to[2] - from[2]) * span,
  ]
}

function clearTimers() {
  for (const id of timers) window.clearTimeout(id)
  timers = []
}

export function cancelVisit() {
  clearTimers()
  if (!visit) return
  visit = null
  emit()
}

function freeSlot(sauna: Sauna): Slot | undefined {
  const taken = new Set(sauna.occupants.map((person) => person.slot))
  return (
    sauna.slots.find((slot) => slot.id === 'door-1' && !taken.has(slot.id)) ??
    sauna.slots.find((slot) => !taken.has(slot.id))
  )
}

function leaving(sauna: Sauna): { person: Occupant; slot: Slot } | null {
  const ranked = sauna.occupants
    .map((person) => ({ person, slot: sauna.slots.find((slot) => slot.id === person.slot) }))
    .filter((item): item is { person: Occupant; slot: Slot } => item.slot !== undefined)
    .sort((a, b) => b.slot.position[2] - a.slot.position[2])
  return ranked[0] ?? null
}

function feet(slot: Slot): [number, number, number] {
  return [slot.position[0], 0, slot.position[2]]
}

/**
 * Every second arrival at the big sauna.
 * Odd visits do nothing. Even visits alternate leaving and arriving.
 */
export function arriveAtBig(sauna: Sauna, api: VisitApi) {
  arrivals += 1
  if (arrivals % 2 !== 0) return
  const kind = nextKind
  nextKind = kind === 'out' ? 'in' : 'out'
  const played = play(sauna, kind, api) || play(sauna, kind === 'out' ? 'in' : 'out', api)
  if (!played) nextKind = kind
}

function play(sauna: Sauna, kind: VisitKind, api: VisitApi) {
  clearTimers()
  if (kind === 'out') {
    const who = leaving(sauna)
    if (!who) return false
    const script: Visit = {
      roomId: sauna.id,
      kind,
      personId: who.person.id,
      color: who.person.towel,
      from: feet(who.slot),
      via: THRESHOLD,
      to: OUTSIDE,
      slotId: who.slot.id,
      zone: who.slot.zone,
      t0: performance.now(),
      done: 4.6,
    }
    arm(script, api, () => api.removeOccupant(sauna.id, who.person.id))
    return true
  }

  if (sauna.occupants.length >= sauna.capacity) return false
  const slot = freeSlot(sauna)
  if (!slot) return false
  const person: Occupant = {
    id: `g${Math.floor(performance.now()).toString(36)}`,
    slot: slot.id,
    zone: slot.zone,
    towel: '#d8c3a5',
    sinceMin: 0,
    zoneSinceMin: 0,
  }
  const script: Visit = {
    roomId: sauna.id,
    kind,
    personId: person.id,
    color: person.towel,
    from: OUTSIDE,
    via: THRESHOLD,
    to: feet(slot),
    slotId: slot.id,
    zone: slot.zone,
    t0: performance.now(),
    done: 3.3,
  }
  arm(script, api, () => api.addOccupant(sauna.id, person))
  return true
}

function arm(script: Visit, api: VisitApi, commit: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    api.setDoor(script.roomId, script.kind === 'out')
    commit()
    return
  }

  visit = script
  emit()
  // Shut first so the open reads, then swing it open ahead of the walk.
  api.setDoor(script.roomId, false)
  timers.push(
    window.setTimeout(() => {
      if (visit !== script) return
      api.setDoor(script.roomId, true)
    }, 420),
  )
  if (script.kind === 'in') {
    timers.push(
      window.setTimeout(() => {
        if (visit !== script) return
        api.setDoor(script.roomId, false)
      }, 2600),
    )
  }
  timers.push(
    window.setTimeout(() => {
      if (visit !== script) return
      commit()
      visit = null
      emit()
    }, script.done * 1000),
  )
}
