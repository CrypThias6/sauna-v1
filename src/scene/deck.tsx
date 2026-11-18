import { useMemo } from 'react'
import { CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Sauna } from '../types'
import { useWoodMap } from './wood'

const AMBER = '#ffb46a'

type DeckSize = { width: number; depth: number; centerZ: number }

/** Matches the barrel footprint, a little larger, in model metres. */
function deckSize(id: string): DeckSize {
  if (id === 'big') return { width: 2.55, depth: 5.15, centerZ: 0.28 }
  return { width: 2.55, depth: 3.3, centerZ: 0.3 }
}

function latticeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw lattice')
  context.clearRect(0, 0, 128, 128)
  context.strokeStyle = '#d9d2c6'
  context.lineWidth = 7
  context.beginPath()
  for (let i = -2; i <= 6; i += 1) {
    const x = i * 32
    context.moveTo(x, 0)
    context.lineTo(x + 128, 128)
    context.moveTo(x, 0)
    context.lineTo(x - 128, 128)
  }
  context.stroke()
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(3, 2)
  return texture
}

/**
 * Raised deck and the outdoor LED clipped to the top of the lattice skirt.
 * `on` is only the Outdoor switch. Temperature is not read here.
 */
export function DeckSkirt({ sauna, on }: { sauna: Sauna; on: boolean }) {
  const { width, depth, centerZ } = deckSize(sauna.id)
  const boards = useWoodMap('#4a3828', '#24180f', [2, 3])
  const lattice = useMemo(latticeTexture, [])
  const skirtH = 0.46
  const skirtY = -skirtH / 2
  const halfW = width / 2
  const halfD = depth / 2
  const strip = 0.028
  const glow = on ? 2.4 : 0.05

  return (
    <group position={[0, 0, centerZ]}>
      <mesh position={[0, -0.03, 0]} receiveShadow castShadow>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial
          map={boards}
          color="#3a2b1e"
          roughness={0.86}
          emissive={AMBER}
          emissiveIntensity={on ? 0.18 : 0}
        />
      </mesh>

      {(
        [
          [0, skirtY, halfD, width, skirtH],
          [0, skirtY, -halfD, width, skirtH],
          [halfW, skirtY, 0, depth, skirtH],
          [-halfW, skirtY, 0, depth, skirtH],
        ] as const
      ).map(([x, y, z, span, height], index) => (
        <mesh key={index} position={[x, y, z]} rotation={index > 1 ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
          <planeGeometry args={[span, height]} />
          <meshStandardMaterial
            color="#1a140f"
            map={lattice}
            transparent
            alphaTest={0.35}
            roughness={0.8}
            side={DoubleSide}
          />
        </mesh>
      ))}

      {(
        [
          [0, 0.012, halfD + 0.01, width + strip, strip, strip],
          [0, 0.012, -halfD - 0.01, width + strip, strip, strip],
          [halfW + 0.01, 0.012, 0, strip, strip, depth + strip],
          [-halfW - 0.01, 0.012, 0, strip, strip, depth + strip],
        ] as const
      ).map(([x, y, z, sx, sy, sz], index) => (
        <mesh key={`led-${index}`} position={[x, y, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial
            color={on ? AMBER : '#2c241c'}
            emissive={AMBER}
            emissiveIntensity={glow}
            roughness={0.35}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.08, depth - 0.08]} />
        <meshBasicMaterial color={AMBER} transparent opacity={on ? 0.22 : 0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
