import { visitsOn, type Visit } from '../data/bookings'
import { flueLabel, fluePhase, temperatureSamples } from './flue'
import { formatTemp } from './format'
import type { Settings } from './settings'
import type { Sauna } from '../types'

export type CheckAction = 'lock' | 'heater' | 'lights'

export type Check = {
  id: string
  label: string
  value: string
  ok: boolean
  action?: CheckAction
  /** Stable while this condition holds. A new key is worth one alert. */
  watch: string | null
  alert: string | null
}

type Due = {
  on: boolean
  booked: Visit | null
  soon: Visit | null
  soonMin: number
}

function windowOf(visit: Visit) {
  const [hour, minute] = visit.time.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  const start = hour * 60 + minute
  return { start, end: start + visit.minutes }
}

function dueFor(sauna: Sauna, now: number): Due {
  const date = new Date(now)
  const minute = date.getHours() * 60 + date.getMinutes()
  const visits = visitsOn(date.getFullYear(), date.getMonth(), date.getDate()).filter(
    (visit) => visit.status !== 'cancelled' && (visit.room === '' || visit.room === sauna.name),
  )
  let booked: Visit | null = null
  let soon: Visit | null = null
  let soonMin = Infinity
  for (const visit of visits) {
    const span = windowOf(visit)
    if (!span) continue
    if (minute >= span.start && minute < span.end) booked = visit
    else if (span.start > minute && span.start - minute < soonMin) {
      soon = visit
      soonMin = span.start - minute
    }
  }
  return { on: sauna.session.active || booked != null, booked, soon, soonMin }
}

function row(
  id: string,
  label: string,
  value: string,
  ok: boolean,
  watch: string | null,
  alert: string | null,
  action?: CheckAction,
): Check {
  return { id, label, value, ok, watch: ok ? watch : `${id}:${watch ?? 'bad'}`, alert: ok ? alert : alert, action }
}

/** What the owner can scan for this room. Failures are the alerts she turned on. */
export function roomChecks(sauna: Sauna, settings: Settings, now: number): Check[] {
  const due = dueFor(sauna, now)
  const sessionOn = due.on
  const people = sauna.occupants.length
  const lightsOn = sauna.lights.filter((light) => light.on).length
  const air = `${formatTemp(sauna.airC)}°`
  const target = Math.round(sauna.targetC)
  const checks: Check[] = []

  const tooHot = settings.heat && sauna.airC > settings.tooHot
  const under = settings.heat && sessionOn && sauna.airC < sauna.targetC - settings.underBy
  checks.push(
    row(
      'temp',
      'Temp',
      tooHot ? `${air} · too hot` : under ? `${air} · under ${target}°` : `${air} · target ${target}°`,
      !tooHot && !under,
      tooHot ? 'hot' : under ? 'under' : null,
      tooHot ? `${air} · too hot` : under ? `${air} · under target` : null,
    ),
  )

  const locked = sauna.lock === 'locked'
  const lockedOut = settings.door && settings.doorLockedSession && sessionOn && locked
  const leftOpen = settings.door && settings.doorOpenIdle && !sessionOn && (sauna.doorOpen || !locked)
  let doorValue = sauna.doorOpen ? 'Open' : locked ? 'Locked' : 'Unlocked'
  if (lockedOut) doorValue = 'Locked · session on'
  else if (leftOpen) doorValue = sauna.doorOpen ? 'Open · no session' : 'Unlocked · no session'
  else if (sessionOn && !locked) doorValue = sauna.doorOpen ? 'Open · unlocked' : 'Shut · unlocked'
  checks.push(
    row(
      'door',
      'Door',
      doorValue,
      !lockedOut && !leftOpen,
      lockedOut ? 'locked' : leftOpen ? 'idle' : null,
      lockedOut ? 'Door locked during a session' : leftOpen ? 'Door not secured' : null,
      'lock',
    ),
  )

  const phase = flueLabel(fluePhase(sauna.heaterOn, sauna.airC, settings.safeC, temperatureSamples(sauna.id)))
  const wasted = settings.heat && settings.leftOn && !sessionOn && people === 0 && sauna.heaterOn
  const cold = settings.heat && sessionOn && !sauna.heaterOn && sauna.airC < sauna.targetC - settings.underBy
  checks.push(
    row(
      'heater',
      'Heater',
      wasted ? 'On · room is empty' : cold ? 'Off · not at temperature' : sauna.heaterOn ? phase : 'Off',
      !wasted && !cold,
      wasted ? 'empty' : cold ? 'cold' : null,
      wasted ? 'Heater on in an empty room' : cold ? 'Heater off during a session' : null,
      'heater',
    ),
  )

  const ending = sauna.session.active && sauna.session.endsInMin <= 0
  const missed = settings.session && due.booked != null && !sauna.session.active
  const soon = settings.session && !sessionOn && due.soon != null && due.soonMin <= settings.leadMin
  let sessionValue = 'No session'
  if (sauna.session.active) {
    sessionValue = ending ? 'Ending' : `${Math.ceil(sauna.session.endsInMin)} min · ${sauna.session.mode}`
  } else if (missed && due.booked) sessionValue = `${due.booked.name} · not started`
  else if (soon && due.soon) sessionValue = `Starts ${due.soon.time}`
  checks.push(
    row(
      'session',
      'Session',
      sessionValue,
      !missed,
      missed ? 'missed' : soon && due.soon ? `soon:${due.soon.id}` : null,
      missed ? 'A booking is on and the session has not started' : soon && due.soon ? `Session at ${due.soon.time}` : null,
    ),
  )

  const over = people > sauna.capacity
  const empty = settings.session && sessionOn && people === 0
  checks.push(
    row(
      'people',
      'People',
      over ? `${people} of ${sauna.capacity} · over` : empty ? 'Empty · session on' : `${people} of ${sauna.capacity}`,
      !over && !empty,
      over ? 'over' : empty ? 'empty' : null,
      over ? 'Over capacity' : empty ? 'Nobody in for the session' : null,
    ),
  )

  const low = settings.water && sauna.water === 'low'
  checks.push(row('water', 'Water', low ? 'Low' : 'Ok', !low, low ? 'low' : null, low ? 'Water low' : null))

  const lightsWasted = settings.leftOn && !sessionOn && people === 0 && lightsOn > 0
  const lightsDark = settings.session && sessionOn && lightsOn === 0
  checks.push(
    row(
      'lights',
      'Lights',
      lightsWasted ? 'On · room is empty' : lightsDark ? 'Off · session on' : lightsOn > 0 ? `${lightsOn} on` : 'Off',
      !lightsWasted && !lightsDark,
      lightsWasted ? 'on' : lightsDark ? 'off' : null,
      lightsWasted ? 'Lights on in an empty room' : lightsDark ? 'Lights off during a session' : null,
      'lights',
    ),
  )

  const co2High = settings.co2On && sauna.co2 > settings.co2Max
  checks.push(
    row(
      'co2',
      'CO₂',
      co2High ? `${sauna.co2} ppm · high` : `${sauna.co2} ppm`,
      !co2High,
      co2High ? 'high' : null,
      co2High ? 'CO₂ high' : null,
    ),
  )

  return checks
}
