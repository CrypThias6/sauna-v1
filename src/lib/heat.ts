const STOPS: [number, [number, number, number]][] = [
  [25, [158, 176, 186]],
  [55, [232, 170, 104]],
  [80, [255, 122, 54]],
  [105, [255, 68, 28]],
]

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function rgb(channels: [number, number, number]) {
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`
}

/** Air-temperature color used by the UI and the heater glow. */
export function heatHex(celsius: number): string {
  if (celsius <= STOPS[0][0]) return rgb(STOPS[0][1])
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i - 1]
    const [t2, c2] = STOPS[i]
    if (celsius <= t2) {
      const u = (celsius - t1) / (t2 - t1)
      const mixed = c1.map((channel, k) => Math.round(channel + (c2[k] - channel) * u)) as [
        number,
        number,
        number,
      ]
      return rgb(mixed)
    }
  }
  return rgb(STOPS[STOPS.length - 1][1])
}

/** 0 when the room is cool, 1 when it is very hot. */
export function heatUnit(celsius: number) {
  return clamp((celsius - 30) / 70, 0, 1)
}
