import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, Path, Shape, type Group } from 'three'
import type { Sauna } from '../types'
import { heatHex, heatUnit } from '../lib/heat'
import { useHinge } from './hinge'
import { useWoodMap } from './wood'

const RADIUS = 1.12
const STAVES = 20

function frontShape() {
  const shape = new Shape()
  shape.absarc(0, 0, RADIUS, 0, Math.PI * 2, false)
  const hole = new Path()
  hole.moveTo(-0.4, -1.08)
  hole.lineTo(-0.4, 0.72)
  hole.lineTo(0.4, 0.72)
  hole.lineTo(0.4, -1.08)
  hole.closePath()
  shape.holes.push(hole)
  return shape
}

export function Barrel({ sauna }: { sauna: Sauna }) {
  const stave = useWoodMap('#e6d3b4', '#b89a72', [1, 3])
  const inner = useWoodMap('#c9aa7e', '#8c704c', [1.4, 2])
  const dark = useWoodMap('#6d5438', '#2e2418', [1, 1])
  const doorRef = useRef<Group>(null)
  const staves = useRef<Group>(null)
  const shape = useMemo(frontShape, [])
  const camera = useThree((state) => state.camera)
  useHinge(doorRef, sauna.doorOpen)

  useFrame(() => {
    const group = staves.current
    if (!group) return
    const elevated = camera.position.y > 2.25
    group.children.forEach((child) => {
      const outwardY = child.userData.outwardY as number
      child.visible = !(elevated && outwardY > 0.28)
    })
  })

  const heat = heatUnit(sauna.airC)
  const glow = heatHex(sauna.airC)
  const stoneIntensity = sauna.heaterOn ? 0.2 + heat * 1.5 * (0.25 + sauna.heaterPower) : heat * 0.1

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, -0.05, 0.7]} receiveShadow>
        <circleGeometry args={[4.2, 48]} />
        <meshStandardMaterial color="#0b0c0a" roughness={1} />
      </mesh>

      {[-0.7, 0.7].map((z) => (
        <mesh key={z} position={[0, 0.08, z]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.14, 0.2]} />
          <meshStandardMaterial map={dark} roughness={0.9} />
        </mesh>
      ))}

      <group ref={staves}>
        {Array.from({ length: STAVES }, (_, i) => {
          const angle = (i / STAVES) * Math.PI * 2
          const outwardY = Math.cos(angle)
          return (
            <mesh
              key={i}
              userData={{ outwardY }}
              position={[Math.sin(angle) * RADIUS, RADIUS + Math.cos(angle) * RADIUS, 0]}
              rotation={[0, 0, -angle]}
              castShadow
            >
              <boxGeometry args={[0.4, 0.07, 2.52]} />
              <meshStandardMaterial map={stave} roughness={0.78} />
            </mesh>
          )
        })}
      </group>

      <mesh position={[0, RADIUS, -1.26]}>
        <circleGeometry args={[RADIUS - 0.01, 36]} />
        <meshStandardMaterial map={inner} roughness={0.86} side={DoubleSide} />
      </mesh>
      <mesh position={[0, RADIUS, 1.26]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial map={stave} roughness={0.8} side={DoubleSide} />
      </mesh>
      {[-0.55, 0.55, 1.26].map((z) => (
        <mesh key={z} position={[0, RADIUS, z]}>
          <torusGeometry args={[RADIUS + 0.02, 0.028, 8, 40]} />
          <meshStandardMaterial color="#2a2a28" metalness={0.8} roughness={0.32} />
        </mesh>
      ))}

      <mesh position={[0, 0.08, -0.05]} receiveShadow>
        <boxGeometry args={[1.55, 0.08, 2.15]} />
        <meshStandardMaterial map={inner} roughness={0.9} />
      </mesh>
      <mesh position={[-0.5, 0.46, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.08, 1.6]} />
        <meshStandardMaterial map={inner} roughness={0.8} />
      </mesh>
      <mesh position={[0.5, 0.46, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.08, 1.6]} />
        <meshStandardMaterial map={inner} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.26, -0.98]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.48, 16]} />
        <meshStandardMaterial color="#2e3134" metalness={0.7} roughness={0.38} />
      </mesh>
      <group position={[0, 0.54, -0.98]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[(i % 3) * 0.08 - 0.08, Math.floor(i / 3) * 0.06, (i % 2) * 0.07 - 0.03]}>
            <dodecahedronGeometry args={[0.05 + (i % 3) * 0.01, 0]} />
            <meshStandardMaterial color="#6a6560" emissive={glow} emissiveIntensity={stoneIntensity} roughness={0.55} />
          </mesh>
        ))}
      </group>

      <group ref={doorRef} position={[-0.36, 0, 1.3]}>
        <mesh position={[0.36, 0.92, 0]} castShadow>
          <boxGeometry args={[0.68, 1.7, 0.045]} />
          <meshStandardMaterial map={stave} roughness={0.72} />
        </mesh>
        <mesh position={[0.36, 1.05, 0.028]}>
          <boxGeometry args={[0.42, 1.15, 0.012]} />
          <meshStandardMaterial color="#d7ebe8" transparent opacity={0.22} roughness={0.05} side={DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0.62, 0.9, 0.04]}>
          <boxGeometry args={[0.02, 0.14, 0.04]} />
          <meshStandardMaterial color="#d9d3c8" metalness={0.75} roughness={0.28} />
        </mesh>
      </group>

      <mesh position={[-0.46, 1.25, 1.32]}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshStandardMaterial
          color={sauna.lock === 'locked' ? '#ffb15a' : '#b6ffc8'}
          emissive={sauna.lock === 'locked' ? '#ff8a2a' : '#4dff88'}
          emissiveIntensity={1.4}
        />
      </mesh>

      {sauna.lights.map((light) => (
        <mesh key={light.id} position={light.position}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial
            color={light.on ? '#fff6e8' : '#2a2724'}
            emissive={light.on ? '#ffd7a4' : '#000000'}
            emissiveIntensity={light.on ? 1.5 : 0}
          />
        </mesh>
      ))}

      <mesh position={[0.35, 0.05, 2.05]} receiveShadow>
        <boxGeometry args={[3.3, 0.1, 1.55]} />
        <meshStandardMaterial map={dark} roughness={0.92} />
      </mesh>
      <mesh position={[1.45, 0.4, 1.95]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.1, 0.42]} />
        <meshStandardMaterial map={inner} roughness={0.8} />
      </mesh>
    </group>
  )
}

