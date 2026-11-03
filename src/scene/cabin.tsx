import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, type Group, type MeshStandardMaterial } from 'three'
import type { Sauna } from '../types'
import { heatHex, heatUnit } from '../lib/heat'
import { useHinge } from './hinge'
import { useWoodMap } from './wood'

function Glass({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <meshStandardMaterial
      color="#d7ebe8"
      transparent
      opacity={opacity}
      roughness={0.06}
      metalness={0}
      side={DoubleSide}
      depthWrite={false}
    />
  )
}

export function Cabin({ sauna }: { sauna: Sauna }) {
  const wall = useWoodMap('#6b3c24', '#2a140c', [1.6, 2])
  const dark = useWoodMap('#3e2416', '#140c08', [2, 2])
  const bench = useWoodMap('#8d5b39', '#3a2416', [2, 1])
  const doorRef = useRef<Group>(null)
  const roof = useRef<MeshStandardMaterial>(null)
  const camera = useThree((state) => state.camera)
  useHinge(doorRef, sauna.doorOpen)

  useFrame(() => {
    const material = roof.current
    if (!material) return
    const fade = Math.min(1, Math.max(0, (camera.position.y - 2.15) / 1.3))
    material.opacity = 1 - fade * 0.9
    material.depthWrite = material.opacity > 0.85
  })

  const heat = heatUnit(sauna.airC)
  const glow = heatHex(sauna.airC)
  const stoneIntensity = sauna.heaterOn ? 0.25 + heat * 1.7 * (0.25 + sauna.heaterPower) : heat * 0.12

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.3, -0.045, 0.35]} receiveShadow>
        <circleGeometry args={[3.6, 48]} />
        <meshStandardMaterial color="#0b0c0a" roughness={1} />
      </mesh>

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.7, 0.06, 2.4]} />
        <meshStandardMaterial map={dark} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[2.36, 0.04, 2.08]} />
        <meshStandardMaterial map={bench} roughness={0.9} />
      </mesh>

      <mesh position={[0, 1.08, -1.12]} castShadow>
        <boxGeometry args={[2.52, 2.16, 0.08]} />
        <meshStandardMaterial map={wall} roughness={0.86} />
      </mesh>
      <mesh position={[-1.22, 1.08, 0]} castShadow>
        <boxGeometry args={[0.08, 2.16, 2.32]} />
        <meshStandardMaterial map={wall} roughness={0.86} />
      </mesh>
      <mesh position={[1.22, 1.08, 0]} castShadow>
        <boxGeometry args={[0.08, 2.16, 2.32]} />
        <meshStandardMaterial map={wall} roughness={0.86} />
      </mesh>

      <mesh position={[-0.82, 1.08, 1.12]} castShadow>
        <boxGeometry args={[0.8, 2.16, 0.08]} />
        <meshStandardMaterial map={wall} roughness={0.86} />
      </mesh>
      <mesh position={[0.77, 1.08, 1.12]} castShadow>
        <boxGeometry args={[0.9, 2.16, 0.08]} />
        <meshStandardMaterial map={wall} roughness={0.86} />
      </mesh>
      <mesh position={[-0.05, 2.03, 1.12]} castShadow>
        <boxGeometry args={[0.74, 0.26, 0.08]} />
        <meshStandardMaterial map={wall} roughness={0.86} />
      </mesh>

      <mesh position={[0, 2.18, 0]} castShadow>
        <boxGeometry args={[2.62, 0.07, 2.42]} />
        <meshStandardMaterial ref={roof} map={dark} roughness={0.9} transparent />
      </mesh>

      <group ref={doorRef} position={[-0.42, 0, 1.12]}>
        <mesh position={[0.37, 1.0, 0]} castShadow>
          <boxGeometry args={[0.7, 1.88, 0.045]} />
          <meshStandardMaterial map={wall} roughness={0.75} />
        </mesh>
        <mesh position={[0.37, 1.15, 0.028]}>
          <boxGeometry args={[0.46, 1.2, 0.012]} />
          <Glass />
        </mesh>
        <mesh position={[0.66, 0.98, 0.04]}>
          <boxGeometry args={[0.025, 0.16, 0.04]} />
          <meshStandardMaterial color="#d9d3c8" metalness={0.75} roughness={0.28} />
        </mesh>
      </group>

      <mesh position={[-0.5, 1.35, 1.17]}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshStandardMaterial
          color={sauna.lock === 'locked' ? '#ffb15a' : '#b6ffc8'}
          emissive={sauna.lock === 'locked' ? '#ff8a2a' : '#4dff88'}
          emissiveIntensity={1.4}
        />
      </mesh>

      <mesh position={[-0.15, 0.84, -0.72]} castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.12, 0.48]} />
        <meshStandardMaterial map={bench} roughness={0.78} />
      </mesh>
      <mesh position={[-0.15, 0.48, -0.78]} castShadow>
        <boxGeometry args={[1.55, 0.6, 0.12]} />
        <meshStandardMaterial map={dark} roughness={0.9} />
      </mesh>
      <mesh position={[-0.4, 0.4, -0.16]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.1, 0.42]} />
        <meshStandardMaterial map={bench} roughness={0.78} />
      </mesh>

      <mesh position={[0.78, 0.28, 0.48]} castShadow>
        <boxGeometry args={[0.4, 0.56, 0.4]} />
        <meshStandardMaterial color="#2e3134" metalness={0.72} roughness={0.38} />
      </mesh>
      <mesh position={[0.78, 1.2, 0.48]}>
        <cylinderGeometry args={[0.035, 0.045, 1.15, 10]} />
        <meshStandardMaterial color="#2a2c2e" metalness={0.7} roughness={0.4} />
      </mesh>
      <group position={[0.78, 0.6, 0.48]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[(i % 3) * 0.09 - 0.09, Math.floor(i / 3) * 0.07, ((i * 2) % 3) * 0.07 - 0.07]} castShadow>
            <dodecahedronGeometry args={[0.055 + (i % 3) * 0.012, 0]} />
            <meshStandardMaterial color="#6a6560" emissive={glow} emissiveIntensity={stoneIntensity} roughness={0.55} />
          </mesh>
        ))}
      </group>

      {sauna.lights.map((light) => (
        <mesh key={light.id} position={light.position}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial
            color={light.on ? '#fff6e8' : '#2a2724'}
            emissive={light.on ? '#ffd7a4' : '#000000'}
            emissiveIntensity={light.on ? 1.6 : 0}
          />
        </mesh>
      ))}

      <mesh position={[1.9, -0.01, 0.45]} receiveShadow>
        <boxGeometry args={[1.25, 0.06, 1.35]} />
        <meshStandardMaterial map={dark} roughness={0.95} />
      </mesh>
      <mesh position={[1.9, 0.55, -0.2]} castShadow>
        <boxGeometry args={[1.25, 1.1, 0.06]} />
        <meshStandardMaterial map={wall} roughness={0.88} />
      </mesh>
      <mesh position={[2.5, 0.55, 0.45]} castShadow>
        <boxGeometry args={[0.06, 1.1, 1.35]} />
        <meshStandardMaterial map={wall} roughness={0.88} />
      </mesh>
      <mesh position={[1.85, 0.36, 0.35]} castShadow receiveShadow>
        <boxGeometry args={[0.85, 0.1, 0.42]} />
        <meshStandardMaterial map={bench} roughness={0.8} />
      </mesh>
    </group>
  )
}
