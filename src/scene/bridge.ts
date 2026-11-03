import type { Camera, Vector3 } from 'three'

export type ControlsApi = {
  enabled: boolean
  target: Vector3
  update: () => void
}

/** Shared with the DOM gesture layer. The canvas reads it every frame; React does not. */
export type Bridge = {
  index: number
  drag: number
  count: number
  controls: ControlsApi | null
  camera: Camera | null
  saved: { cam: Vector3; target: Vector3 } | null
}
