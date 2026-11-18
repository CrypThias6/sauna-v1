/**
 * Outdoor LED path along the top of the modelled lattice skirt.
 * Temperature and humidity are not inputs. The Outdoor switch decides brightness.
 */

export type XZ = { x: number; z: number }
export type XYZ = { x: number; y: number; z: number }

/** How far the cable sits outside the lattice face, in metres. */
export const LED_OUTSET = 0.022
/** Catenary scale. Larger is tauter. About 9 cm of sag on a 0.65 m span. */
export const LED_SAG_A = 0.62
/** Target distance between clips. */
export const LED_SPAN = 0.65

/** How many clips a run of this length needs. Long runs stay within 0.5–0.8 m. */
export function spanCount(length: number) {
  if (length < 0.45) return 1
  let count = Math.max(1, Math.round(length / LED_SPAN))
  while (length / count > 0.8) count += 1
  return count
}

/** Drop below the clips. u = 0 and u = 1 sit on the clip; u = 0.5 is the bottom. */
export function catenaryDrop(span: number, u: number, a = LED_SAG_A) {
  const x = (u - 0.5) * span
  return a * Math.cosh(span / (2 * a)) - a * Math.cosh(x / a)
}

/** Monotone chain. Result is counter-clockwise when looking down. */
export function convexHull(points: XZ[]): XZ[] {
  const sorted = points
    .map((point) => ({ x: point.x, z: point.z }))
    .sort((a, b) => a.x - b.x || a.z - b.z)
  const unique: XZ[] = []
  for (const point of sorted) {
    const prev = unique[unique.length - 1]
    if (prev && prev.x === point.x && prev.z === point.z) continue
    unique.push(point)
  }
  if (unique.length <= 2) return unique

  const cross = (o: XZ, a: XZ, b: XZ) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  const lower: XZ[] = []
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop()
    lower.push(point)
  }
  const upper: XZ[] = []
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop()
    upper.push(point)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/**
 * Push a counter-clockwise ring outward so each edge moves by `dist`.
 * Corners mitre, so the cable clears the lattice instead of cutting the corner.
 */
export function offsetOutward(hull: XZ[], dist: number): XZ[] {
  const count = hull.length
  if (count < 3 || dist === 0) return hull.map((point) => ({ ...point }))
  const normals = hull.map((point, index) => {
    const next = hull[(index + 1) % count]
    const dx = next.x - point.x
    const dz = next.z - point.z
    const length = Math.hypot(dx, dz) || 1
    return { x: dz / length, z: -dx / length }
  })
  return hull.map((point, index) => {
    const prev = normals[(index - 1 + count) % count]
    const next = normals[index]
    const bx = prev.x + next.x
    const bz = prev.z + next.z
    const length = Math.hypot(bx, bz) || 1
    const dot = prev.x * next.x + prev.z * next.z
    const scale = (dist * length) / (1 + dot)
    return { x: point.x + (bx / length) * scale, z: point.z + (bz / length) * scale }
  })
}

/** Samples along the ring. Each span sags on its own catenary between clips. */
export function swagPath(ring: XZ[], topY: number, a = LED_SAG_A): XYZ[] {
  const path: XYZ[] = []
  const count = ring.length
  for (let edge = 0; edge < count; edge += 1) {
    const from = ring[edge]
    const to = ring[(edge + 1) % count]
    const length = Math.hypot(to.x - from.x, to.z - from.z)
    if (length < 1e-4) continue
    const pieces = spanCount(length)
    const steps = 8
    for (let piece = 0; piece < pieces; piece += 1) {
      const span = length / pieces
      for (let step = 0; step < steps; step += 1) {
        const u = step / steps
        const t = (piece + u) / pieces
        path.push({
          x: from.x + (to.x - from.x) * t,
          y: topY - catenaryDrop(span, u, a),
          z: from.z + (to.z - from.z) * t,
        })
      }
    }
  }
  return path
}

/** Clip-to-clip distances. Points that sit on the clip height are the attachments. */
export function clipSpans(path: XYZ[], topY: number) {
  const clips = path.filter((point) => Math.abs(point.y - topY) < 1e-6)
  const spans: number[] = []
  for (let i = 0; i < clips.length; i += 1) {
    const a = clips[i]
    const b = clips[(i + 1) % clips.length]
    spans.push(Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y))
  }
  return spans
}
