/** Meters between room origins. Far enough that an orbit of one never shows the other. */
export const ROOM_SPACING = 22

/** Where the orbit looks, before the swipe offset is added on X. */
export const LOOK_Y = 0.9
export const LOOK_Z = 0.2

/** Fully zoomed out, same tilt the small sauna already uses. */
export const CAMERA_DISTANCE = 9
export const CAMERA_PHI = 1.4
const CAMERA_THETA = Math.atan2(2.55, 4.65)

export function homeCamera(): [number, number, number] {
  const sinPhi = Math.sin(CAMERA_PHI)
  return [
    CAMERA_DISTANCE * sinPhi * Math.sin(CAMERA_THETA),
    LOOK_Y + CAMERA_DISTANCE * Math.cos(CAMERA_PHI),
    LOOK_Z + CAMERA_DISTANCE * sinPhi * Math.cos(CAMERA_THETA),
  ]
}

/**
 * Big barrel only. The long door-end already sits left of the small sauna,
 * so this is a short step back toward that frame, plus a small lift.
 */
export const BIG_NUDGE = { x: 0.16, y: 0.1, z: -0.06 }

/** Desktop distance. The long barrel steps back on a narrow frame; the small one never does. */
export function frameDistance(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return CAMERA_DISTANCE
  const wide = Math.max(aspect, 0.32)
  const half = (32 * Math.PI) / 360
  const span = (value: number) => 2 * Math.atan(Math.tan(half) * value)
  const filled = 0.48 * (span(1.5) / span(wide))
  const limit = 0.74
  if (filled <= limit) return CAMERA_DISTANCE
  return CAMERA_DISTANCE * (filled / limit)
}
