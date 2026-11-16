/** When the mock book should ask Piqo to run a saved Action. Nothing here calls Piqo. */

export const PIQO_ACTIONS = [
  'Glow on',
  'Glow off',
  'Outdoor on',
  'Outdoor off',
  'Gentle flash',
  'Warning flash',
] as const

export type PiqoAction = (typeof PIQO_ACTIONS)[number]

export type LightVisit = {
  id: string
  time: string
  minutes: number
  room: string
  name: string
  people: number
  status?: string
}

export type LightMemory = {
  glow: 'on' | 'off' | null
  glowHold: 'on' | 'off' | null
  holdVisits: string
  gentle: string[]
  outdoor: 'on' | 'off' | null
  outdoorHold: 'on' | 'off' | null
  outdoorSlot: string
}

/** A 15-minute mark counts only while this tick still covers it. */
export const GENTLE_GRACE_MS = 25_000

export const emptyLights = (): LightMemory => ({
  glow: null,
  glowHold: null,
  holdVisits: '',
  gentle: [],
  outdoor: null,
  outdoorHold: null,
  outdoorSlot: '',
})

export function isPiqoAction(value: unknown): value is PiqoAction {
  return typeof value === 'string' && (PIQO_ACTIONS as readonly string[]).includes(value)
}

function bounds(visit: LightVisit, day: Date) {
  if (visit.status === 'cancelled' || visit.status === 'no_show') return null
  if (!visit.time.includes(':')) return null
  const [hour, minute] = visit.time.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || visit.minutes <= 0) return null
  const start = new Date(day)
  start.setHours(hour, minute, 0, 0)
  return { startMs: start.getTime(), endMs: start.getTime() + visit.minutes * 60_000 }
}

export function activeVisits(visits: LightVisit[], now: Date) {
  const at = now.getTime()
  return visits.filter((visit) => {
    const span = bounds(visit, now)
    return span != null && at >= span.startMs && at < span.endMs
  })
}

function clockMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

/** 'on' between the two local times. Equal times, or a bad time, stay off. */
export function outdoorDesired(now: Date, on: string, off: string): 'on' | 'off' {
  const start = clockMinutes(on)
  const end = clockMinutes(off)
  if (start == null || end == null || start === end) return 'off'
  const minute = now.getHours() * 60 + now.getMinutes()
  if (start < end) return minute >= start && minute < end ? 'on' : 'off'
  return minute >= start || minute < end ? 'on' : 'off'
}

function visitKey(visits: LightVisit[]) {
  return visits
    .map((visit) => visit.id)
    .sort()
    .join(',')
}

/**
 * One step of the light schedule.
 * Glow follows whoever is booked right now. A staff hold lasts until that set of bookings changes.
 * Gentle flash is the 15-minute marks after the start, and only the mark this tick still covers.
 * Outdoor follows the set times. A staff hold lasts until the next time boundary.
 * The first time the schedule is seen, glow and outdoor are applied only if they should be on,
 * so opening the console in the afternoon does not send an off.
 */
export function stepLights(
  memory: LightMemory,
  now: Date,
  visits: LightVisit[],
  outdoorOn: string,
  outdoorOff: string,
  staff?: PiqoAction | null,
): { memory: LightMemory; actions: PiqoAction[] } {
  const next: LightMemory = { ...memory, gentle: memory.gentle.slice() }
  const actions: PiqoAction[] = []
  const active = activeVisits(visits, now)
  const key = visitKey(active)

  if (staff === 'Glow on' || staff === 'Glow off') {
    next.glowHold = staff === 'Glow on' ? 'on' : 'off'
    next.holdVisits = key
    next.glow = next.glowHold
    actions.push(staff)
  } else if (staff === 'Outdoor on' || staff === 'Outdoor off') {
    next.outdoorHold = staff === 'Outdoor on' ? 'on' : 'off'
    next.outdoorSlot = outdoorDesired(now, outdoorOn, outdoorOff)
    next.outdoor = next.outdoorHold
    actions.push(staff)
  } else if (staff === 'Gentle flash' || staff === 'Warning flash') {
    actions.push(staff)
  }

  if (next.glowHold && next.holdVisits !== key) next.glowHold = null
  const glow = next.glowHold ?? (active.length > 0 ? 'on' : 'off')
  if (next.glow === null) {
    next.glow = glow
    if (glow === 'on') actions.push('Glow on')
  } else if (next.glow !== glow) {
    next.glow = glow
    actions.push(glow === 'on' ? 'Glow on' : 'Glow off')
  }

  const at = now.getTime()
  let flash = false
  for (const visit of active) {
    const span = bounds(visit, now)
    if (!span) continue
    for (let mark = 1; span.startMs + mark * 15 * 60_000 < span.endMs; mark += 1) {
      const boundary = span.startMs + mark * 15 * 60_000
      if (at < boundary || at >= boundary + GENTLE_GRACE_MS) continue
      const id = `${visit.id}:${mark}`
      if (next.gentle.includes(id)) continue
      next.gentle.push(id)
      flash = true
    }
  }
  if (next.gentle.length > 80) next.gentle.splice(0, next.gentle.length - 80)
  if (flash) actions.push('Gentle flash')

  const desiredOutdoor = outdoorDesired(now, outdoorOn, outdoorOff)
  if (next.outdoorHold && next.outdoorSlot !== desiredOutdoor) next.outdoorHold = null
  const outdoor = next.outdoorHold ?? desiredOutdoor
  if (next.outdoor === null) {
    next.outdoor = outdoor
    if (outdoor === 'on') actions.push('Outdoor on')
  } else if (next.outdoor !== outdoor) {
    next.outdoor = outdoor
    actions.push(outdoor === 'on' ? 'Outdoor on' : 'Outdoor off')
  }

  return { memory: next, actions }
}
