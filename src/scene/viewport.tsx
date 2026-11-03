import { useLayoutEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MathUtils, Vector3 } from 'three'
import type { Sauna } from '../types'
import type { Bridge, ControlsApi } from './bridge'
import { SaunaBody } from './gltf'
import { BIG_NUDGE, CAMERA_DISTANCE, frameDistance, homeCamera, LOOK_Y, LOOK_Z, ROOM_SPACING } from './space'

const TARGET: [number, number, number] = [0, LOOK_Y, LOOK_Z]
const HOME = homeCamera()
const OFFSET = new Vector3()

function World({ saunas, bridge }: { saunas: Sauna[]; bridge: Bridge }) {
  const controls = useRef<ControlsApi>(null)
  const camera = useThree((state) => state.camera)
  const framed = useRef(CAMERA_DISTANCE)

  useLayoutEffect(() => {
    bridge.camera = camera
    return () => {
      bridge.camera = null
      bridge.controls = null
    }
  }, [bridge, camera])

  // Priority -2 runs before OrbitControls' own update, so a room change
  // translates the camera and the orbit target together.
  useFrame((state, dt) => {
    const api = controls.current
    if (!api) return
    bridge.controls = api
    bridge.camera = camera
    const dest = bridge.index * ROOM_SPACING + bridge.drag
    const next = MathUtils.damp(api.target.x, dest, bridge.drag !== 0 ? 14 : 4, dt)
    const dx = next - api.target.x
    api.target.x = next
    camera.position.x += dx
    // Same tilt as the home camera. The long barrel steps back on a narrow frame; the small one stays.
    const view = state.gl.domElement
    const aspect = view.clientWidth / Math.max(1, view.clientHeight)
    const distance = saunas[bridge.index]?.id === 'big' ? frameDistance(aspect) : CAMERA_DISTANCE
    if (Math.abs(distance - framed.current) > 0.02) {
      OFFSET.copy(camera.position).sub(api.target)
      const length = OFFSET.length()
      if (length > 0.05) {
        OFFSET.setLength(length * (distance / framed.current))
        camera.position.copy(api.target).add(OFFSET)
      }
      framed.current = distance
    }
  }, -2)

  return (
    <>
      <color attach="background" args={['#0c0d0b']} />
      <hemisphereLight args={['#ead9c4', '#12140f', 0.42]} />
      <directionalLight position={[-6, 4, -3]} intensity={0.28} color="#9eb4c6" />
      <OrbitControls
        ref={controls as never}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.6}
        maxDistance={22}
        minPolarAngle={0.4}
        maxPolarAngle={1.45}
        target={TARGET}
      />
      {saunas.map((sauna, i) => (
        <group
          key={sauna.id}
          name={`room-${sauna.id}`}
          position={[
            i * ROOM_SPACING + (sauna.id === 'big' ? BIG_NUDGE.x : 0),
            sauna.id === 'big' ? BIG_NUDGE.y : 0,
            sauna.id === 'big' ? BIG_NUDGE.z : 0,
          ]}
        >
          <directionalLight
            position={[3.2, 6.4, 4.2]}
            intensity={1.45}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-near={0.5}
            shadow-camera-far={18}
            shadow-camera-left={-4.5}
            shadow-camera-right={4.5}
            shadow-camera-top={4.5}
            shadow-camera-bottom={-4.5}
            shadow-bias={-0.0006}
          />
          <SaunaBody sauna={sauna} />
        </group>
      ))}
    </>
  )
}

export function Viewport({ saunas, bridge }: { saunas: Sauna[]; bridge: Bridge }) {
  return (
    <Canvas
      className="canvas"
      shadows
      dpr={[1, 1.75]}
      camera={{ position: HOME, fov: 32, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false }}
    >
      <World saunas={saunas} bridge={bridge} />
    </Canvas>
  )
}
