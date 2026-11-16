/** Saved Piqo Actions. The operate call is a stub until Tim confirms the HTTP request. */

export const ACTIONS = ['Glow on', 'Glow off', 'Outdoor on', 'Outdoor off', 'Gentle flash', 'Warning flash'] as const

export type PiqoAction = (typeof ACTIONS)[number]

export type PiqoResult = {
  sent: false
  reason: 'no operate token yet' | 'operate API not wired' | 'too soon' | 'unknown action'
}

const TOGGLE_GAP_MS = 60_000

export function isPiqoAction(value: unknown): value is PiqoAction {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value)
}

export function lightOf(action: string): 'glow' | 'outdoor' | null {
  if (action === 'Glow on' || action === 'Glow off') return 'glow'
  if (action === 'Outdoor on' || action === 'Outdoor off') return 'outdoor'
  return null
}

/**
 * Record an action without sending it.
 * checkGap skips a second toggle of the same light inside about 60 seconds.
 * The sensor reading is not an argument.
 */
export function runPiqoAction(
  name: string,
  options?: { now?: number; lastToggleAt?: number | null; checkGap?: boolean },
): PiqoResult {
  if (!isPiqoAction(name)) return { sent: false, reason: 'unknown action' }
  const now = options?.now ?? Date.now()
  if (options?.checkGap && lightOf(name)) {
    const last = options.lastToggleAt
    if (last != null && now - last < TOGGLE_GAP_MS) return { sent: false, reason: 'too soon' }
  }
  if (!(process.env.PIQO_OPERATE_TOKEN ?? '').trim()) return { sent: false, reason: 'no operate token yet' }
  // TODO(Tim): call the Piqo operate API for `name` on PIQO_TWIN_ID.
  // PIQO_BASE_URL is the host. Do not guess the path, method, or body.
  // Nothing is sent until that request is filled in.
  return { sent: false, reason: 'operate API not wired' }
}
