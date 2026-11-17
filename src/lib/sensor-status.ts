/** How fresh the newest SHT4x reading is. Display only. */

export const SENSOR_FRESH_MS = 5 * 60 * 1000

export type SensorLink = 'online' | 'offline' | 'unreachable'

export function newestHeard(times: Array<string | null | undefined>) {
  let best: string | null = null
  let bestMs = Number.NEGATIVE_INFINITY
  for (const time of times) {
    if (!time) continue
    const ms = Date.parse(time)
    if (Number.isFinite(ms) && ms > bestMs) {
      best = time
      bestMs = ms
    }
  }
  return best
}

/** True when at least one Piqo response was not a network failure, a 5xx, or a refusal. */
export function piqoReachable(pulls: { status: number }[]) {
  return pulls.some((pull) => pull.status >= 200 && pull.status < 500 && pull.status !== 401 && pull.status !== 403)
}

/**
 * Online: newest SHT4x time is under 5 minutes old.
 * Offline: Piqo answered, but the newest reading is older than that, or missing.
 * Unreachable: the Piqo calls themselves failed.
 */
export function sensorLink(input: { now: number; heardAt: string | null; reachable: boolean }): SensorLink {
  if (!input.reachable) return 'unreachable'
  const at = input.heardAt ? Date.parse(input.heardAt) : Number.NaN
  if (!Number.isFinite(at)) return 'offline'
  const age = input.now - at
  if (age > SENSOR_FRESH_MS) return 'offline'
  return 'online'
}
