import { useMemo } from 'react'
import { createPortal } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Matrix4, Object3D, Vector3, type Mesh } from 'three'
import { shownOutdoor, useOutdoorHold } from '../lib/light-panel'
import { useSettings } from '../lib/settings'
import { useSauna } from '../state/store'
import { LED_OUTSET, convexHull, offsetOutward, swagPath, type XYZ } from './swag'

const AMBER = '#ffb46a'
const OFF = '#2a231c'

/**
 * LED swags on the original deck lattice.
 * `on` is only the Outdoor switch. Temperature and humidity are not read.
 */
export function DeckLeds({ deck }: { deck: Object3D }) {
  const on = useOutdoorOn()
  const points = useMemo(() => swagOnDeck(deck), [deck])
  const cable = useMemo(() => (points ? tubeGeometry(points, 0.008) : null), [points])
  const wash = useMemo(() => (points ? tubeGeometry(points, 0.026) : null), [points])
  if (!points || !cable || !wash) return null
  return createPortal(
    <group name="OutdoorLedStrip">
      <mesh geometry={wash} visible={on} renderOrder={1}>
        <meshBasicMaterial color={AMBER} transparent opacity={0.22} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
      </mesh>
      <mesh geometry={cable} renderOrder={2}>
        <meshStandardMaterial
          color={on ? AMBER : OFF}
          emissive={AMBER}
          emissiveIntensity={on ? 2.4 : 0.03}
          roughness={0.42}
          toneMapped={false}
        />
      </mesh>
    </group>,
    deck,
  )
}

function useOutdoorOn() {
  const { now } = useSauna()
  const settings = useSettings()
  const hold = useOutdoorHold()
  return shownOutdoor(new Date(now), settings.outdoorOn, settings.outdoorOff, hold) === 'on'
}

/** One tube around the closed swag. The frame stays upright so the strip does not twist. */
function tubeGeometry(points: XYZ[], radius: number) {
  const sides = 6
  const count = points.length
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const up = new Vector3(0, 1, 0)
  const tangent = new Vector3()
  const side = new Vector3()
  const binormal = new Vector3()
  const frames = points.map((_, index) => {
    const prev = points[(index - 1 + count) % count]
    const next = points[(index + 1) % count]
    tangent.set(next.x - prev.x, next.y - prev.y, next.z - prev.z)
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0)
    else tangent.normalize()
    side.copy(up).addScaledVector(tangent, -up.dot(tangent))
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
    else side.normalize()
    binormal.crossVectors(tangent, side).normalize()
    return { side: side.clone(), binormal: binormal.clone() }
  })

  for (let index = 0; index < count; index += 1) {
    const point = points[index]
    const frame = frames[index]
    for (let step = 0; step < sides; step += 1) {
      const angle = (step / sides) * Math.PI * 2
      const cx = Math.cos(angle)
      const cy = Math.sin(angle)
      const nx = frame.side.x * cx + frame.binormal.x * cy
      const ny = frame.side.y * cx + frame.binormal.y * cy
      const nz = frame.side.z * cx + frame.binormal.z * cy
      positions.push(point.x + nx * radius, point.y + ny * radius, point.z + nz * radius)
      normals.push(nx, ny, nz)
    }
  }
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count
    for (let step = 0; step < sides; step += 1) {
      const step2 = (step + 1) % sides
      const a = index * sides + step
      const b = index * sides + step2
      const c = next * sides + step
      const d = next * sides + step2
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Top edge of the Lattice material, outset past the face, then hung in swags.
 * Returns null when this model has no lattice to clip to.
 */
export function swagOnDeck(deck: Object3D): XYZ[] | null {
  const top = latticeTop(deck)
  if (top.length < 4) return null
  const topY = top.reduce((max, point) => Math.max(max, point.y), -Infinity)
  const ring = offsetOutward(
    convexHull(top.map((point) => ({ x: point.x, z: point.z }))),
    LED_OUTSET,
  )
  if (ring.length < 3) return null
  const path = swagPath(ring, topY)
  return path.length >= 8 ? path : null
}

function latticeTop(deck: Object3D) {
  const inverse = new Matrix4()
  deck.updateWorldMatrix(true, false)
  inverse.copy(deck.matrixWorld).invert()
  const sample = new Vector3()
  const found: XYZ[] = []

  deck.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const position = mesh.geometry.getAttribute('position')
    if (!position) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const groups = mesh.geometry.groups.length
      ? mesh.geometry.groups
      : [{ start: 0, count: mesh.geometry.index ? mesh.geometry.index.count : position.count, materialIndex: 0 }]
    mesh.updateWorldMatrix(true, false)
    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0]
      if (!material || !/lattice/i.test(material.name)) continue
      const index = mesh.geometry.index
      const end = group.start + group.count
      let maxY = -Infinity
      const local: XYZ[] = []
      for (let i = group.start; i < end; i += 1) {
        const vertex = index ? index.getX(i) : i
        sample.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex))
        sample.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse)
        local.push({ x: sample.x, y: sample.y, z: sample.z })
        if (sample.y > maxY) maxY = sample.y
      }
      for (const point of local) {
        if (point.y >= maxY - 0.02) found.push(point)
      }
    }
  })
  return found
}
