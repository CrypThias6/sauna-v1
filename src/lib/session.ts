export type Gate = 'unknown' | 'needed' | 'in'

let gate: Gate = 'unknown'
let generation = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function sessionGate() {
  return gate
}

export function sessionGeneration() {
  return generation
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function markSession(next: Gate) {
  if (gate === next) return
  gate = next
  generation += 1
  emit()
}

/** Same-origin fetch. A 401 opens the staff login. A missing API does not. */
export async function staffFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  const type = response.headers.get('content-type') ?? ''
  if (response.status === 401) markSession('needed')
  else if (response.ok && type.includes('json')) markSession('in')
  return response
}
