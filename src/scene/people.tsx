import { useLayoutEffect, useRef } from 'react'
import { useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import type { Sauna, Slot } from '../types'
import { getVisit, hiddenId, subscribeVisit, walkPoint } from './visit'

function Figure({ seated, color }: { seated: boolean; color: string }) {
  const skin = '#e7c6ab'
  if (seated) {
    return (
      <group>
        <mesh position={[0, 0.16, 0.1]} castShadow>
          <boxGeometry args={[0.34, 0.14, 0.3]} />
          <meshStandardMaterial color={color} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[0.3, 0.32, 0.2]} />
          <meshStandardMaterial color={color} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.68, 0.02]}>
          <sphereGeometry args={[0.11, 16, 12]} />
          <meshStandardMaterial color={skin} roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.68, 0.12]}>
          <boxGeometry args={[0.03, 0.025, 0.04]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <mesh position={[0, 0.46, 0]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13, 0.46, 4, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.15, 0.28, 4, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.38, 0]} frustumCulled={false}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshBasicMaterial color={skin} />
      </mesh>
      <mesh position={[0, 1.4, 0.11]}>
        <boxGeometry args={[0.03, 0.03, 0.04]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
    </group>
  )
}

function Person({ slot, color }: { slot: Slot; color: string }) {
  const ref = useRef<Group>(null)
  const slotRef = useRef(slot)
  slotRef.current = slot

  useLayoutEffect(() => {
    const group = ref.current
    const place = slotRef.current
    if (!group) return
    group.position.set(place.position[0], place.position[1], place.position[2])
    group.rotation.y = place.yaw
  }, [])

  useFrame((_, dt) => {
    const group = ref.current
    if (!group) return
    const place = slotRef.current
    const k = 3
    group.position.x = MathUtils.damp(group.position.x, place.position[0], k, dt)
    group.position.y = MathUtils.damp(group.position.y, place.position[1], k, dt)
    group.position.z = MathUtils.damp(group.position.z, place.position[2], k, dt)
    const diff = Math.atan2(Math.sin(place.yaw - group.rotation.y), Math.cos(place.yaw - group.rotation.y))
    group.rotation.y += diff * (1 - Math.exp(-k * dt))
  })

  return (
    <group ref={ref}>
      <Figure seated={slot.seated} color={color} />
    </group>
  )
}

/** Glowing seat marks parented to the Bench of a loaded model. */
export function BenchMarkers({ sauna }: { sauna: Sauna }) {
  const hidden = useSyncExternalStore(subscribeVisit, hiddenId, hiddenId)
  return (
    <group>
      {sauna.occupants.map((person) => {
        if (person.id === hidden) return null
        const slot = sauna.slots.find((item) => item.id === person.slot)
        if (!slot) return null
        return <Marker key={person.id} slot={slot} color={person.towel} />
      })}
    </group>
  )
}

/** Someone crossing the big sauna's door. Position is in sauna metres. Stays mounted so the walk cannot miss a frame. */
export function Walker({ roomId }: { roomId: string }) {
  const ref = useRef<Group>(null)
  const visit = useSyncExternalStore(subscribeVisit, getVisit, getVisit)
  const active = visit && visit.roomId === roomId ? visit : null
  const point = active ? walkPoint(active, performance.now()) : null

  useFrame(() => {
    const group = ref.current
    if (!group) return
    const current = getVisit()
    const on = !!current && current.roomId === roomId
    group.visible = on
    if (!on || !current) return
    const next = walkPoint(current, performance.now())
    group.position.set(next[0], next[1], next[2])
    group.rotation.y = current.kind === 'out' ? 0 : Math.PI
  })

  return (
    <group
      ref={ref}
      name="Walker"
      position={point ?? [0, 0, 0]}
      visible={!!active}
      frustumCulled={false}
    >
      <Figure seated={false} color={active?.color ?? '#f3efe6'} />
    </group>
  )
}

function Marker({ slot, color }: { slot: Slot; color: string }) {
  const ref = useRef<Group>(null)
  const slotRef = useRef(slot)
  slotRef.current = slot

  useLayoutEffect(() => {
    const group = ref.current
    const place = slotRef.current
    if (!group) return
    group.position.set(place.position[0], place.position[1], place.position[2])
  }, [])

  useFrame((_, dt) => {
    const group = ref.current
    if (!group) return
    const place = slotRef.current
    const k = 3
    group.position.x = MathUtils.damp(group.position.x, place.position[0], k, dt)
    group.position.y = MathUtils.damp(group.position.y, place.position[1], k, dt)
    group.position.z = MathUtils.damp(group.position.z, place.position[2], k, dt)
  })

  if (slot.seated) {
    return (
      <group ref={ref}>
        <mesh position={[0, 0.07, 0]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} roughness={0.4} />
        </mesh>
      </group>
    )
  }

  return (
    <group ref={ref}>
      <mesh position={[0, 0.48, 0]}>
        <capsuleGeometry args={[0.09, 0.46, 4, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0.45} />
      </mesh>
    </group>
  )
}

export function People({ sauna }: { sauna: Sauna }) {
  return (
    <group>
      {sauna.occupants.map((person) => {
        const slot = sauna.slots.find((item) => item.id === person.slot)
        if (!slot) return null
        return <Person key={person.id} slot={slot} color={person.towel} />
      })}
    </group>
  )
}

export function Steam({ sauna }: { sauna: Sauna }) {
  const ref = useRef<Group>(null)
  const seeds = useRef(
    Array.from({ length: 6 }, (_, i) => ({
      phase: i * 0.17,
      x: ((i % 3) - 1) * 0.08,
      z: (i % 2 === 0 ? -1 : 1) * 0.06,
      speed: 0.12 + (i % 3) * 0.04,
    })),
  )

  useFrame(({ clock }) => {
    const group = ref.current
    if (!group) return
    const heat = MathUtils.clamp((sauna.airC - 45) / 50, 0, 1) * (sauna.heaterOn ? 1 : 0.35)
    group.visible = heat > 0.08
    seeds.current.forEach((seed, i) => {
      const mesh = group.children[i]
      if (!mesh) return
      const t = (clock.elapsedTime * seed.speed + seed.phase) % 1
      mesh.position.set(sauna.heater[0] + seed.x, sauna.heater[1] + t * 0.9, sauna.heater[2] + seed.z)
      mesh.scale.setScalar(0.7 + t * 0.8)
      const material = (mesh as { material?: { opacity: number } }).material
      if (material) material.opacity = heat * (1 - t) * 0.2
    })
  })

  return (
    <group ref={ref}>
      {seeds.current.map((seed, i) => (
        <mesh key={i} position={[sauna.heater[0] + seed.x, sauna.heater[1], sauna.heater[2]]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#fff6ee" transparent opacity={0.08} depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
