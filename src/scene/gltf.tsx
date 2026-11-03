import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  Box3,
  Color,
  DoubleSide,
  Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type PointLight,
} from 'three'
import type { Sauna } from '../types'
import { BIG_MODEL, SMALL_MODEL } from '../data/saunas'
import { heatUnit } from '../lib/heat'
import { useHinge } from './hinge'
import { Barrel } from './barrel'
import { Cabin } from './cabin'
import { BenchMarkers, People, Steam, Walker } from './people'

useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
useGLTF.preload(SMALL_MODEL, true)
useGLTF.preload(BIG_MODEL, true)

function Procedural({ sauna }: { sauna: Sauna }) {
  return sauna.kind === 'barrel' ? <Barrel sauna={sauna} /> : <Cabin sauna={sauna} />
}

type BoundaryProps = { children: ReactNode; fallback: ReactNode }
type BoundaryState = { failed: boolean }

class ModelBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Outward swing in radians. Sign is chosen from which edge the hinge sits on. */
const DOOR_SWING = 1.35

function isStandard(material: Material): material is MeshStandardMaterial {
  return 'emissive' in material && 'emissiveIntensity' in material
}

function isGlass(material: MeshStandardMaterial) {
  return material.transparent || material.opacity < 0.95 || /glass/i.test(material.name)
}

function cloneMaterials(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const cloned = source.map((material) => {
      const next = material.clone()
      if (isStandard(next) && isGlass(next)) {
        next.side = DoubleSide
        next.depthWrite = false
        // The exported door glass is almost black, so the interior light never
        // shows through it. Lighten it enough to read the room, keep the tint.
        if (next.name === 'Door_Glass_Tinted') {
          next.color.set('#c4aa9a')
          next.opacity = 0.45
          next.transparent = true
        }
      }
      return next
    })
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
    const glass = cloned.some((material) => isStandard(material) && isGlass(material))
    mesh.castShadow = !glass
    mesh.receiveShadow = !glass
  })
}

function eachOpaque(object: Object3D, visit: (material: MeshStandardMaterial) => void) {
  object.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!isStandard(material) || isGlass(material)) continue
      visit(material)
    }
  })
}

type Rig = {
  root: Object3D
  hinge: Object3D | null
  /** Positive rotation.y swings the free edge toward +z when the hinge is on +x. */
  openAngle: number
  handle: [number, number, number]
  bench: Object3D | null
  heater: Object3D | null
}

/**
 * The Door node's origin is the barrel centre, not the hinge. Reparent it onto
 * a pivot at the +X edge (handle is on the viewer's left from +Z) so it swings
 * out of that edge instead of orbiting the room.
 */
function prepareModel(source: Object3D): Rig {
  const root = source.clone(true)
  cloneMaterials(root)
  root.updateWorldMatrix(true, true)

  const door = root.getObjectByName('Door')
  let hinge: Object3D | null = null
  let openAngle = DOOR_SWING
  let handle: [number, number, number] = [0, 1, 0]

  if (door?.parent) {
    const box = new Box3().setFromObject(door)
    const hingeX = box.max.x
    const freeX = box.min.x
    const midZ = (box.min.z + box.max.z) / 2
    const pivot = new Group()
    pivot.name = 'DoorHinge'
    pivot.position.set(hingeX, 0, midZ)
    door.parent.add(pivot)
    pivot.attach(door)
    hinge = pivot
    openAngle = freeX < hingeX ? DOOR_SWING : -DOOR_SWING
    const handleX = freeX + Math.sign(hingeX - freeX) * 0.07
    handle = [handleX - hingeX, 1.02, box.max.z - midZ + 0.02]
  }

  return {
    root,
    hinge,
    openAngle,
    handle,
    bench: root.getObjectByName('Bench') ?? null,
    heater: root.getObjectByName('Heater') ?? null,
  }
}

function InteriorGlow({ sauna }: { sauna: Sauna }) {
  const fill = useRef<PointLight>(null)
  const stove = useRef<PointLight>(null)
  const color = useRef(new Color('#ffb070'))
  const hot = useRef(new Color('#ff5a28'))

  useFrame(() => {
    const heat = heatUnit(sauna.airC)
    const on = sauna.lights.filter((light) => light.on).length / Math.max(1, sauna.lights.length)
    color.current.set('#ffb070').lerp(hot.current, heat)
    const level = (0.9 + heat * 9) * (0.05 + 0.95 * on)
    if (fill.current) {
      fill.current.color.copy(color.current)
      fill.current.intensity = level
    }
    if (stove.current) {
      stove.current.color.copy(color.current)
      stove.current.intensity = sauna.heaterOn ? level * (0.4 + sauna.heaterPower) : level * 0.08
    }
  })

  return (
    <>
      <pointLight ref={fill} position={[0, 1.15, 0.15]} distance={9} decay={2} color="#ffb070" />
      <pointLight ref={stove} position={sauna.heater} distance={2.6} decay={2} color="#ffb070" />
    </>
  )
}

function LoadedModel({ url, sauna }: { url: string; sauna: Sauna }) {
  const gltf = useGLTF(url, true)
  const rig = useMemo(() => prepareModel(gltf.scene), [gltf.scene])
  const hingeRef = useRef<Object3D | null>(rig.hinge)
  hingeRef.current = rig.hinge
  useHinge(hingeRef, sauna.doorOpen, rig.openAngle)
  const glow = useRef(new Color('#ffb070'))
  const hot = useRef(new Color('#ff5a28'))

  useFrame(() => {
    const heat = heatUnit(sauna.airC)
    glow.current.set('#ffb070').lerp(hot.current, heat)
    const locked = sauna.lock === 'locked'
    if (rig.hinge) {
      const door = rig.hinge.getObjectByName('Door')
      if (door) {
        eachOpaque(door, (material) => {
          // Tint the steel frame only. Painting the cedar hides the wood.
          if (material.name !== 'Steel') {
            material.emissive.set('#000000')
            material.emissiveIntensity = 0
            return
          }
          material.emissive.set(locked ? '#ff4b3a' : '#3ee07a')
          material.emissiveIntensity = locked ? 0.45 : 0.32
        })
      }
    }
    if (rig.heater) {
      const stone = sauna.heaterOn ? 0.3 + heat * 2.4 * (0.25 + sauna.heaterPower) : heat * 0.12
      eachOpaque(rig.heater, (material) => {
        if (material.name !== 'Steel') {
          material.emissive.set('#000000')
          material.emissiveIntensity = 0
          return
        }
        material.emissive.copy(glow.current)
        material.emissiveIntensity = stone
      })
    }
  })

  return (
    <group position={sauna.modelOffset} rotation={[0, sauna.modelYaw, 0]} scale={sauna.modelScale}>
      <primitive object={rig.root} />
      {rig.hinge &&
        createPortal(
          <mesh position={rig.handle}>
            <sphereGeometry args={[0.032, 14, 10]} />
            <meshStandardMaterial
              color="#1a120e"
              emissive={sauna.lock === 'locked' ? '#ff4b3a' : '#3ee07a'}
              emissiveIntensity={2.2}
            />
          </mesh>,
          rig.hinge,
        )}
      {rig.bench && createPortal(<BenchMarkers sauna={sauna} />, rig.bench)}
      <InteriorGlow sauna={sauna} />
    </group>
  )
}

function FallbackLights({ sauna }: { sauna: Sauna }) {
  const lightsOn = sauna.lights.filter((light) => light.on).length
  const heat = heatUnit(sauna.airC)
  return (
    <>
      <pointLight
        position={[0, 1.65, 0.1]}
        intensity={0.3 + 2.15 * (lightsOn / Math.max(1, sauna.lights.length))}
        distance={6.5}
        color="#ffd8b0"
      />
      <pointLight
        position={sauna.heater}
        color="#ffb070"
        distance={3.6}
        intensity={sauna.heaterOn ? 0.45 + heat * 4 * (0.35 + sauna.heaterPower) : heat * 0.2}
      />
    </>
  )
}

export function SaunaBody({ sauna }: { sauna: Sauna }) {
  const fallback = (
    <>
      <Procedural sauna={sauna} />
      <People sauna={sauna} />
      <FallbackLights sauna={sauna} />
    </>
  )

  return (
    <group>
      {sauna.modelUrl ? (
        <ModelBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <LoadedModel url={sauna.modelUrl} sauna={sauna} />
          </Suspense>
        </ModelBoundary>
      ) : (
        fallback
      )}
      <Walker roomId={sauna.id} />
      <Steam sauna={sauna} />
    </group>
  )
}
