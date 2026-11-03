export type Vec3 = [number, number, number]

export type Slot = {
  id: string
  /** Camera id this seat belongs to. */
  zone: string
  place: string
  /** Meters. Floor is y = 0. The sauna's door faces +z. */
  position: Vec3
  seated: boolean
  /** Radians around Y. 0 looks toward +z (the door). */
  yaw: number
}

export type Occupant = {
  id: string
  slot: string
  zone: string
  towel: string
  sinceMin: number
  zoneSinceMin: number
}

export type CameraZone = {
  id: string
  label: string
  /** Short word used in the corner summary. */
  short: string
}

export type Light = {
  id: string
  label: string
  on: boolean
  /** Bulb position in sauna space, meters. */
  position: Vec3
}

export type SaunaKind = 'cabin' | 'barrel'

/**
 * One room the operator can watch.
 *
 * Spatial contract for a dropped-in model (see README):
 * meters, floor at y = 0, front door facing +z.
 * People, cameras, and the heater light use `slots` and `heater`
 * in that same space — they are not baked into the file.
 */
export type Sauna = {
  id: string
  name: string
  kind: SaunaKind
  kindLabel: string
  capacity: number
  modelUrl: string | null
  /** Yaw applied once so a loaded file's door faces +z. Leave 0 until the file is measured. */
  modelYaw: number
  /** 1 = the file is already in meters. */
  modelScale: number
  /** Shift applied after scale, in meters, to sit the file on the floor. */
  modelOffset: Vec3
  airC: number
  targetC: number
  benchC: number
  humidity: number
  co2: number
  heaterOn: boolean
  /** 0–1. The preview sim moves this toward what the target needs. */
  heaterPower: number
  /** Stones / stove, used for the heat light even when a model is loaded. */
  heater: Vec3
  doorOpen: boolean
  lock: 'locked' | 'unlocked'
  lights: Light[]
  energyKw: number
  water: 'ok' | 'low'
  session: { active: boolean; endsInMin: number; mode: string }
  cameras: CameraZone[]
  slots: Slot[]
  occupants: Occupant[]
}
