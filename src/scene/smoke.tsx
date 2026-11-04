import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import type { Sauna } from '../types'
import { fluePhase, temperatureSamples } from '../lib/flue'
import { useSettings } from '../lib/settings'

const PUFFS = [
  { phase: 0.04, x: 0.03, z: 0.01 },
  { phase: 0.26, x: -0.05, z: 0.04 },
  { phase: 0.48, x: 0.06, z: -0.03 },
  { phase: 0.7, x: -0.02, z: 0.05 },
  { phase: 0.88, x: 0.04, z: -0.02 },
]

/** Rises off the flue. +Y is up in the sauna frame. Hidden only when the room is safe to leave. */
export function ChimneySmoke({ sauna, mouth }: { sauna: Sauna; mouth: [number, number, number] }) {
  const ref = useRef<Group>(null)
  const { safeC } = useSettings()
  const phase = fluePhase(sauna.heaterOn, sauna.airC, safeC, temperatureSamples(sauna.id))
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useFrame(({ clock }) => {
    const group = ref.current
    if (!group) return
    const current = phaseRef.current
    group.visible = current !== 'safe'
    if (current === 'safe') return
    const period = current === 'cooling' ? 3.1 : 2.3
    const amount = current === 'cooling' ? 0.42 : 0.62
    PUFFS.forEach((puff, i) => {
      const mesh = group.children[i] as Mesh | undefined
      if (!mesh) return
      const t = (clock.elapsedTime / period + puff.phase) % 1
      const rise = t * t * (3 - 2 * t)
      mesh.position.set(puff.x * rise, rise * 1.15, puff.z * rise)
      const scale = 0.22 + rise * 0.85
      mesh.scale.setScalar(scale)
      const material = mesh.material as MeshBasicMaterial
      const fade = rise < 0.12 ? rise / 0.12 : 1 - MathUtils.smoothstep(rise, 0.55, 1)
      material.opacity = Math.max(0, fade) * amount
    })
  })

  return (
    <group ref={ref} position={mouth} visible={phase !== 'safe'}>
      {PUFFS.map((puff) => (
        <mesh key={puff.phase} frustumCulled={false}>
          <sphereGeometry args={[0.14, 12, 10]} />
          <meshBasicMaterial color="#e4dfd6" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
