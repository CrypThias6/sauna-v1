import { useSyncExternalStore } from 'react'

export type Settings = {
  name: string
  door: boolean
  heat: boolean
  water: boolean
  session: boolean
  /** No chimney smoke once the room is under this and still falling or settled. */
  safeC: number
}

const KEY = 'sauna-settings'

const defaults: Settings = {
  name: '',
  door: true,
  heat: true,
  water: true,
  session: true,
  safeC: 40,
}

let current = read()
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<Settings>
    const safeC = Number(parsed.safeC)
    return {
      ...defaults,
      ...parsed,
      safeC: Number.isFinite(safeC) ? Math.min(80, Math.max(20, Math.round(safeC))) : defaults.safeC,
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
