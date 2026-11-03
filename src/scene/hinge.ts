import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Object3D } from 'three'

/** Shut = 0. The sign of `openAngle` is chosen per door so the free edge swings toward +z. */
const DOOR_OPEN = -1.55

export function useHinge(ref: RefObject<Object3D | null>, open: boolean, openAngle = DOOR_OPEN) {
  const openRef = useRef(open)
  openRef.current = open
  const angleRef = useRef(openAngle)
  angleRef.current = openAngle
  const reduce = useRef(false)

  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useFrame((_, dt) => {
    const object = ref.current
    if (!object) return
    const target = openRef.current ? angleRef.current : 0
    object.rotation.y = reduce.current ? target : MathUtils.damp(object.rotation.y, target, 5, dt)
  })
}
