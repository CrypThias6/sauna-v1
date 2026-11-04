/** Samples kept per room. One preview tick is one second. */
const WINDOW = 8

export type Flue = 'heating' | 'cooling' | 'safe'

const history = new Map<string, number[]>()

export function noteTemperature(id: string, airC: number) {
  const row = history.get(id) ?? []
  row.push(airC)
  if (row.length > WINDOW) row.shift()
  history.set(id, row)
}

export function temperatureSamples(id: string): readonly number[] {
  return history.get(id) ?? []
}

/**
 * `down` is a real fall across the window, not one cooler sample.
 * `flat` is settled. `up` is still climbing. `short` is not enough yet.
 */
export function temperatureTrend(samples: readonly number[]): 'down' | 'flat' | 'up' | 'short' {
  if (samples.length < WINDOW) return 'short'
  const oldest = samples[0]
  const newest = samples[samples.length - 1]
  const drop = oldest - newest
  let rises = 0
  let falls = 0
  for (let i = 1; i < samples.length; i++) {
    const delta = samples[i] - samples[i - 1]
    if (delta > 0.05) rises += 1
    else if (delta < -0.05) falls += 1
  }
  const stillFalling = newest <= samples[samples.length - 3]
  if (drop >= 0.6 && falls > rises && stillFalling) return 'down'
  if (Math.abs(drop) < 0.6 && rises === 0) return 'flat'
  return 'up'
}

/** Smoke while heating, and while it is still hot after the heater is off. */
export function fluePhase(heaterOn: boolean, airC: number, safeC: number, samples: readonly number[]): Flue {
  if (heaterOn) return 'heating'
  const trend = temperatureTrend(samples)
  if (airC < safeC && (trend === 'down' || trend === 'flat')) return 'safe'
  return 'cooling'
}

export function flueLabel(phase: Flue) {
  if (phase === 'heating') return 'Heating'
  if (phase === 'cooling') return 'Cooling down'
  return 'Safe to leave'
}
