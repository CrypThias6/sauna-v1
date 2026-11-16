/**
 * Runs a saved Piqo Action through its Action link.
 * The sensor reading is not an argument and must not become one.
 */

export const ACTIONS = ['Glow on', 'Glow off', 'Outdoor on', 'Outdoor off', 'Gentle flash', 'Warning flash'] as const

export type PiqoAction = (typeof ACTIONS)[number]

export const PIQO_TIMEOUT_MS = 10_000

const LINK_ENV: Record<PiqoAction, string> = {
  'Glow on': 'PIQO_LINK_GLOW_ON',
  'Glow off': 'PIQO_LINK_GLOW_OFF',
  'Outdoor on': 'PIQO_LINK_OUTDOOR_ON',
  'Outdoor off': 'PIQO_LINK_OUTDOOR_OFF',
  'Gentle flash': 'PIQO_LINK_GENTLE_FLASH',
  'Warning flash': 'PIQO_LINK_WARNING_FLASH',
}

export type PiqoResult = {
  ok: boolean
  receiptId: string | null
  state: string | null
  sent: boolean
  reason: string
  error?: string
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

function failure(reason: string, error: string): PiqoResult {
  return { ok: false, receiptId: null, state: null, sent: false, reason, error }
}

function linkFor(name: PiqoAction) {
  return process.env[LINK_ENV[name]]?.trim() ?? ''
}

async function postLink(url: string): Promise<{ retry: true; error: string } | { retry: false; result: PiqoResult }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ request_id: crypto.randomUUID() }),
      signal: AbortSignal.timeout(PIQO_TIMEOUT_MS),
    })
    if (response.status >= 500) return { retry: true, error: `Piqo returned ${response.status}` }
    if (response.status === 410) return { retry: false, result: failure('revoked', 'Piqo link is invalid or revoked') }
    if (!response.ok) return { retry: false, result: failure('rejected', `Piqo returned ${response.status}`) }
    const body = (await response.json().catch(() => null)) as { receipt_id?: unknown; state?: unknown } | null
    const receiptId = typeof body?.receipt_id === 'string' ? body.receipt_id : ''
    const state = typeof body?.state === 'string' ? body.state : ''
    if (!receiptId) return { retry: false, result: failure('rejected', 'Piqo did not return a receipt') }
    if (state === 'failed') return { retry: false, result: failure('rejected', 'Piqo reported the action failed') }
    return {
      retry: false,
      result: { ok: true, receiptId, state: state || 'pending', sent: true, reason: state || 'pending' },
    }
  } catch {
    return { retry: true, error: 'Piqo could not be reached' }
  }
}

/**
 * POST the Action link for this name.
 * A missing link logs a warning and returns not configured. It does not throw.
 * Network errors and HTTP 5xx are tried once more. HTTP 4xx is not retried.
 * checkGap skips a second toggle of the same light inside about 60 seconds.
 */
export async function runPiqoAction(
  name: string,
  options?: { now?: number; lastToggleAt?: number | null; checkGap?: boolean },
): Promise<PiqoResult> {
  try {
    if (!isPiqoAction(name)) return failure('unknown action', 'Unknown action.')
    const now = options?.now ?? Date.now()
    if (options?.checkGap && lightOf(name)) {
      const last = options.lastToggleAt
      if (last != null && now - last < TOGGLE_GAP_MS) return failure('too soon', 'Wait about a minute before toggling this light again.')
    }
    const url = linkFor(name)
    if (!url) {
      console.warn(`Piqo action not configured: ${name}`)
      return failure('not configured', 'not configured')
    }
    let lastError = 'Piqo could not be reached'
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outcome = await postLink(url)
      if (!outcome.retry) return outcome.result
      lastError = outcome.error
    }
    console.warn(`Piqo action failed: ${name}`)
    return failure('unavailable', lastError)
  } catch {
    console.warn(`Piqo action failed: ${name}`)
    return failure('unavailable', 'Piqo could not be reached')
  }
}
