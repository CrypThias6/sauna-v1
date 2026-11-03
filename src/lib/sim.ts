import type { Occupant, Sauna, Slot } from '../types'
import { clamp, lerp } from './heat'

function moveSomeone(slots: Slot[], people: Occupant[]): Occupant[] {
  if (people.length === 0) return people
  const index = Math.floor(Math.random() * people.length)
  const taken = new Set(people.map((person) => person.slot))
  const free = slots.filter((slot) => !taken.has(slot.id))
  if (free.length === 0) return people
  const next = free[Math.floor(Math.random() * free.length)]
  return people.map((person, i) =>
    i === index ? { ...person, slot: next.id, zone: next.zone, zoneSinceMin: 0 } : person,
  )
}

/** One second of preview telemetry. Operator commands are left alone. */
export function stepSauna(sauna: Sauna): Sauna {
  const ambient = sauna.doorOpen ? 28 : 36
  const goal = sauna.heaterOn ? sauna.targetC : ambient
  const gap = goal - sauna.airC
  const powerTarget = !sauna.heaterOn ? 0 : gap > 0.6 ? clamp(gap / 18, 0.12, 1) : 0.05
  const heaterPower = lerp(sauna.heaterPower, powerTarget, 0.22)
  const airC = clamp(
    sauna.airC + gap * 0.035 * (0.4 + heaterPower) - (sauna.doorOpen ? 0.12 : 0),
    18,
    110,
  )
  const benchDrop = sauna.kind === 'barrel' ? 6 : 8
  const benchC = lerp(sauna.benchC, airC - benchDrop, 0.08)
  const humidity = clamp(
    lerp(sauna.humidity, (sauna.doorOpen ? 34 : 15) + heaterPower * 24, 0.06),
    8,
    85,
  )
  const co2 = Math.round(
    clamp(lerp(sauna.co2, 430 + sauna.occupants.length * 135 + (sauna.doorOpen ? -30 : 15), 0.06), 400, 2200),
  )
  const energyKw = Number((heaterPower * (sauna.kind === 'barrel' ? 9.2 : 7.4)).toFixed(2))
  const session = sauna.session.active
    ? { ...sauna.session, endsInMin: Math.max(0, sauna.session.endsInMin - 1 / 60) }
    : sauna.session

  let occupants = sauna.occupants.map((person) => ({
    ...person,
    sinceMin: person.sinceMin + 1 / 60,
    zoneSinceMin: person.zoneSinceMin + 1 / 60,
  }))
  if (Math.random() < 0.025) occupants = moveSomeone(sauna.slots, occupants)

  return {
    ...sauna,
    heaterPower,
    airC,
    benchC,
    humidity,
    co2,
    energyKw,
    session,
    occupants,
  }
}
