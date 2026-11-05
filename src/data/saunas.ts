import type { Sauna } from '../types'

/** Public file URL. Respects the GitHub Pages base path. */
export function publicFile(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

export const SMALL_MODEL = publicFile('models/sauna_small.glb')
export const BIG_MODEL = publicFile('models/sauna_big.glb')

/**
 * Two barrel rooms. Models are metres, door facing +z (see docs/MODELS.md).
 * v3 puts the deck skirt below y = 0, so the whole model is lifted 0.5 m
 * and the deck top stays the floor the people stand on.
 */
export const initialSaunas: Sauna[] = [
  {
    id: 'small',
    name: 'Small',
    kind: 'barrel',
    kindLabel: 'Barrel, dark roof',
    capacity: 6,
    modelUrl: SMALL_MODEL,
    modelYaw: 0,
    modelScale: 1,
    modelOffset: [0, 0.5, 0],
    airC: 86.4,
    targetC: 90,
    benchC: 78.2,
    humidity: 17,
    co2: 940,
    heaterOn: true,
    heaterPower: 0.62,
    heater: [0, 0.72, -0.66],
    doorOpen: false,
    lock: 'locked',
    lights: [
      { id: 'ceiling', label: 'Ceiling', on: true, position: [0, 1.55, 0.05] },
      { id: 'bench', label: 'Bench', on: true, position: [0, 1.35, -0.2] },
      { id: 'door', label: 'Door', on: false, position: [0, 1.4, 0.55] },
    ],
    energyKw: 4.6,
    water: 'ok',
    session: { active: true, endsInMin: 18, mode: 'Heat' },
    cameras: [
      { id: 'door', label: 'Door', short: 'door' },
      { id: 'benches', label: 'Benches', short: 'bench' },
      { id: 'heater', label: 'Heater', short: 'heater' },
      { id: 'window', label: 'Window', short: 'window' },
    ],
    slots: [
      { id: 'bench-l1', zone: 'benches', place: 'Left bench', position: [-0.28, 0.58, 0.42], seated: true, yaw: Math.PI / 2 },
      { id: 'bench-l2', zone: 'benches', place: 'Left bench', position: [-0.28, 0.58, -0.05], seated: true, yaw: Math.PI / 2 },
      { id: 'bench-r1', zone: 'benches', place: 'Right bench', position: [0.26, 0.58, 0.2], seated: true, yaw: -Math.PI / 2 },
      { id: 'window-1', zone: 'window', place: 'By the window', position: [0.26, 0.58, -0.45], seated: true, yaw: -Math.PI / 2 },
      { id: 'heat-1', zone: 'heater', place: 'By the heater', position: [-0.28, 0.58, -0.28], seated: true, yaw: Math.PI / 2 },
      { id: 'door-1', zone: 'door', place: 'By the door', position: [0.02, 0, 0.7], seated: false, yaw: Math.PI },
    ],
    occupants: [
      { id: 's1', slot: 'bench-l1', zone: 'benches', towel: '#c46a45', sinceMin: 26, zoneSinceMin: 26 },
      { id: 's2', slot: 'bench-r1', zone: 'benches', towel: '#a6523a', sinceMin: 14, zoneSinceMin: 14 },
      { id: 's3', slot: 'heat-1', zone: 'heater', towel: '#d08968', sinceMin: 9, zoneSinceMin: 4 },
      { id: 's4', slot: 'door-1', zone: 'door', towel: '#8d4a38', sinceMin: 2, zoneSinceMin: 2 },
    ],
  },
  {
    id: 'big',
    name: 'Big',
    kind: 'barrel',
    kindLabel: 'Barrel, bare cedar',
    capacity: 8,
    modelUrl: BIG_MODEL,
    modelYaw: 0,
    modelScale: 1,
    modelOffset: [0, 0.5, 0],
    airC: 72,
    targetC: 75,
    benchC: 66.4,
    humidity: 24,
    co2: 710,
    heaterOn: true,
    heaterPower: 0.28,
    heater: [0, 0.72, -1.6],
    doorOpen: true,
    lock: 'unlocked',
    lights: [
      { id: 'ridge-1', label: 'Ridge', on: true, position: [0, 1.55, 0.4] },
      { id: 'ridge-2', label: 'Ridge', on: true, position: [0, 1.55, -0.6] },
      { id: 'entry', label: 'Entry', on: true, position: [0, 1.45, 1.2] },
    ],
    energyKw: 2.6,
    water: 'low',
    session: { active: false, endsInMin: 0, mode: 'Warm hold' },
    cameras: [
      { id: 'door', label: 'Door', short: 'door' },
      { id: 'benches', label: 'Benches', short: 'bench' },
      { id: 'heater', label: 'Heater', short: 'heater' },
      { id: 'window', label: 'Window', short: 'window' },
    ],
    slots: [
      { id: 'left-1', zone: 'benches', place: 'Left bench', position: [-0.28, 0.58, 1.22], seated: true, yaw: Math.PI / 2 },
      { id: 'left-2', zone: 'benches', place: 'Left bench', position: [-0.28, 0.58, 0.55], seated: true, yaw: Math.PI / 2 },
      { id: 'left-3', zone: 'benches', place: 'Left bench', position: [-0.28, 0.58, -0.2], seated: true, yaw: Math.PI / 2 },
      { id: 'window-1', zone: 'window', place: 'By the window', position: [-0.28, 0.58, -1.15], seated: true, yaw: Math.PI / 2 },
      { id: 'right-1', zone: 'benches', place: 'Right bench', position: [0.26, 0.58, 1.0], seated: true, yaw: -Math.PI / 2 },
      { id: 'right-2', zone: 'benches', place: 'Right bench', position: [0.26, 0.58, 0.25], seated: true, yaw: -Math.PI / 2 },
      { id: 'heat-1', zone: 'heater', place: 'By the heater', position: [0.26, 0.58, -0.7], seated: true, yaw: -Math.PI / 2 },
      { id: 'door-1', zone: 'door', place: 'By the door', position: [0.02, 0, 1.62], seated: false, yaw: Math.PI },
    ],
    occupants: [
      { id: 'b1', slot: 'left-1', zone: 'benches', towel: '#efe2cf', sinceMin: 41, zoneSinceMin: 20 },
      { id: 'b2', slot: 'left-2', zone: 'benches', towel: '#d7c3a4', sinceMin: 33, zoneSinceMin: 33 },
      { id: 'b3', slot: 'right-1', zone: 'benches', towel: '#c6b090', sinceMin: 12, zoneSinceMin: 12 },
      { id: 'b4', slot: 'heat-1', zone: 'heater', towel: '#b7a48a', sinceMin: 8, zoneSinceMin: 8 },
      { id: 'b5', slot: 'window-1', zone: 'window', towel: '#f4eee4', sinceMin: 6, zoneSinceMin: 6 },
      { id: 'b6', slot: 'door-1', zone: 'door', towel: '#e6d5bc', sinceMin: 6, zoneSinceMin: 3 },
    ],
  },
]
