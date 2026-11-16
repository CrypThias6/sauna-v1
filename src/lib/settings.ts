import { useSyncExternalStore } from 'react'

export type Settings = {
  name: string
  door: boolean
  heat: boolean
  water: boolean
  session: boolean
  /** No chimney smoke once the room is under this and still falling or settled. */
  safeC: number
  /** Cross the door when it is locked and a session should be on. */
  doorLockedSession: boolean
  /** Cross the door when it is open or unlocked and nothing is booked. */
  doorOpenIdle: boolean
  /** Degrees under the target before a live session counts as not ready. */
  underBy: number
  /** Air above this is too hot. */
  tooHot: number
  /** Heater or lights left on with nobody in and no session. */
  leftOn: boolean
  /** Warn when CO₂ is above this. */
  co2On: boolean
  co2Max: number
  /** Minutes before a booking to show it on the list. */
  leadMin: number
  /** Local time the outdoor lights should come on. */
  outdoorOn: string
  /** Local time the outdoor lights should go off. */
  outdoorOff: string
  /** Preferred outdoor colour. The saved Piqo action is still warm white. */
  outdoorColor: string
}

const KEY = 'sauna-settings'

const defaults: Settings = {
  name: '',
  door: true,
  heat: true,
  water: true,
  session: true,
  safeC: 40,
  doorLockedSession: true,
  doorOpenIdle: true,
  underBy: 8,
  tooHot: 96,
  leftOn: true,
  co2On: true,
  co2Max: 1200,
  leadMin: 20,
  outdoorOn: '20:30',
  outdoorOff: '23:30',
  outdoorColor: '#ffc58f',
}

let current = read()
const listeners = new Set<() => void>()

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function flag(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function clock(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return fallback
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return fallback
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback
}

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...defaults,
      ...parsed,
      door: flag(parsed.door, defaults.door),
      heat: flag(parsed.heat, defaults.heat),
      water: flag(parsed.water, defaults.water),
      session: flag(parsed.session, defaults.session),
      doorLockedSession: flag(parsed.doorLockedSession, defaults.doorLockedSession),
      doorOpenIdle: flag(parsed.doorOpenIdle, defaults.doorOpenIdle),
      leftOn: flag(parsed.leftOn, defaults.leftOn),
      co2On: flag(parsed.co2On, defaults.co2On),
      safeC: clamp(parsed.safeC, 20, 80, defaults.safeC),
      underBy: clamp(parsed.underBy, 1, 30, defaults.underBy),
      tooHot: clamp(parsed.tooHot, 60, 110, defaults.tooHot),
      co2Max: clamp(parsed.co2Max, 600, 5000, defaults.co2Max),
      leadMin: clamp(parsed.leadMin, 5, 120, defaults.leadMin),
      outdoorOn: clock(parsed.outdoorOn, defaults.outdoorOn),
      outdoorOff: clock(parsed.outdoorOff, defaults.outdoorOff),
      outdoorColor: color(parsed.outdoorColor, defaults.outdoorColor),
      name: typeof parsed.name === 'string' ? parsed.name : defaults.name,
    }
  } catch {
    return { ...defaults }
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

export function getSettings() {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  localStorage.setItem(KEY, JSON.stringify(current))
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}
