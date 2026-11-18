import { useSyncExternalStore } from 'react'
import { outdoorDesired } from './lights'

export type OutdoorHold = { value: 'on' | 'off'; slot: 'on' | 'off' } | null

let hold: OutdoorHold = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * What the Outdoor switch shows.
 * A staff hold lasts until the schedule crosses the next on or off time.
 * Temperature is not an input.
 */
export function shownOutdoor(now: Date, on: string, off: string, staffHold: OutdoorHold = hold): 'on' | 'off' {
  const desired = outdoorDesired(now, on, off)
  if (staffHold && staffHold.slot === desired) return staffHold.value
  return desired
}

export function outdoorHold() {
  return hold
}

export function setOutdoorHold(value: 'on' | 'off', now: Date, on: string, off: string) {
  hold = { value, slot: outdoorDesired(now, on, off) }
  emit()
}

export function clearOutdoorHold() {
  hold = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useOutdoorHold() {
  return useSyncExternalStore(subscribe, outdoorHold, () => null)
}
