import { describe, expect, it } from 'vitest'
import { catenaryDrop, clipSpans, convexHull, offsetOutward, spanCount, swagPath, LED_OUTSET } from './swag'

/** Top vertices of Lattice_White on sauna_small.glb, in model metres. */
const SMALL_TOP: [number, number][] = [
  [-1.264, -1.28],
  [-1.264, 1.83],
  [-1.252, -1.28],
  [-1.252, 1.83],
  [-1.21, -1.314],
  [-1.21, -1.302],
  [-1.21, 1.852],
  [-1.21, 1.864],
  [1.21, -1.314],
  [1.21, -1.302],
  [1.21, 1.852],
  [1.21, 1.864],
  [1.252, -1.28],
  [1.252, 1.83],
  [1.264, -1.28],
  [1.264, 1.83],
]

const TOP_Y = -0.14

function ringFrom(points: [number, number][]) {
  return offsetOutward(
    convexHull(points.map(([x, z]) => ({ x, z }))),
    LED_OUTSET,
  )
}

/** Big lattice is the small one stretched about the same centre. */
function bigTop(): [number, number][] {
  const zs = SMALL_TOP.map(([, z]) => z)
  const centre = (Math.min(...zs) + Math.max(...zs)) / 2
  const scale = (2.814 - -2.264) / (1.864 - -1.314)
  return SMALL_TOP.map(([x, z]) => [x, centre + (z - centre) * scale])
}

describe('deck LED swags', () => {
  it('mitres a rectangle outward without cutting the corner', () => {
    const hull = convexHull([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 1 },
      { x: 0, z: 1 },
    ])
    const offset = offsetOutward(hull, 0.1)
    expect(Math.min(...offset.map((point) => point.x))).toBeCloseTo(-0.1, 5)
    expect(Math.max(...offset.map((point) => point.x))).toBeCloseTo(2.1, 5)
    expect(Math.min(...offset.map((point) => point.z))).toBeCloseTo(-0.1, 5)
    expect(Math.max(...offset.map((point) => point.z))).toBeCloseTo(1.1, 5)
  })

  it('clips the small lattice every 0.5–0.8 m and sags between clips', () => {
    const path = swagPath(ringFrom(SMALL_TOP), TOP_Y)
    const spans = clipSpans(path, TOP_Y).filter((span) => span >= 0.45)
    expect(spans.length).toBeGreaterThan(8)
    for (const span of spans) {
      expect(span).toBeGreaterThanOrEqual(0.5)
      expect(span).toBeLessThanOrEqual(0.8)
    }
    const sag = Math.min(...path.map((point) => point.y))
    expect(TOP_Y - sag).toBeGreaterThan(0.06)
    expect(TOP_Y - sag).toBeLessThan(0.12)
    for (const point of path) {
      const inside = Math.abs(point.x) < 1.2 && point.z > -1.25 && point.z < 1.8
      expect(inside).toBe(false)
    }
  })

  it('fits the longer big deck with the same clip spacing', () => {
    const path = swagPath(ringFrom(bigTop()), TOP_Y)
    const spans = clipSpans(path, TOP_Y).filter((span) => span >= 0.45)
    expect(spans.length).toBeGreaterThan(12)
    for (const span of spans) {
      expect(span).toBeGreaterThanOrEqual(0.5)
      expect(span).toBeLessThanOrEqual(0.8)
    }
    expect(spanCount(5.078)).toBe(8)
    expect(catenaryDrop(0.65, 0)).toBeCloseTo(0, 6)
    expect(catenaryDrop(0.65, 0.5)).toBeGreaterThan(0.07)
  })
})
