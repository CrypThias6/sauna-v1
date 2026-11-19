import { useSyncExternalStore } from 'react'
import { sessionGate, staffFetch, subscribeSession } from './session'

export type SiteChoice = { id: string; name: string; enabled: boolean }

export type SetupReport = {
  simplybook: {
    creds: boolean
    authOk: boolean | null
    permissionOk: boolean | null
    message: string | null
  }
  piqo: { name: string; present: boolean }[]
  sensor: { online: boolean; lastReading: string | null }
  webhookSecret: boolean
  cronSecret: boolean
  locations: SiteChoice[]
  filterLocations: boolean
  notes: string[]
}

let report: SetupReport | null = null
let selected = ''
let error: string | null = null
const listeners = new Set<() => void>()
let timer: number | null = null
let inflight = false

function emit() {
  for (const listener of listeners) listener()
}

export function setupState() {
  const enabled = (report?.locations ?? []).filter((site) => site.enabled)
  const current = enabled.find((site) => site.id === selected) ?? enabled[0] ?? null
  return {
    report,
    error,
    site: {
      id: current?.id ?? '',
      name: current?.name ?? '',
      filtering: report?.filterLocations === true,
    },
    enabled,
  }
}

export function chooseSite(id: string) {
  selected = id
  emit()
}

async function refresh() {
  if (inflight || sessionGate() === 'needed') return
  inflight = true
  try {
    const response = await staffFetch('/api/setup')
    if (response.status === 401) return
    const body = (await response.json().catch(() => null)) as SetupReport | { error?: unknown } | null
    if (!response.ok || !body || !('simplybook' in body)) {
      error = 'Setup could not be read.'
      emit()
      return
    }
    report = body
    error = null
    emit()
  } catch {
    error = 'Setup could not be read.'
    emit()
  } finally {
    inflight = false
  }
}

function ensure() {
  if (timer != null) return
  void refresh()
  timer = window.setInterval(() => void refresh(), 60_000)
  subscribeSession(() => {
    if (sessionGate() === 'in') void refresh()
  })
}

export function subscribeSetup(listener: () => void) {
  listeners.add(listener)
  ensure()
  return () => listeners.delete(listener)
}

export function useSetup() {
  return useSyncExternalStore(subscribeSetup, setupState, () => ({
    report: null,
    error: null,
    site: { id: '', name: '', filtering: false },
    enabled: [] as SiteChoice[],
  }))
}
