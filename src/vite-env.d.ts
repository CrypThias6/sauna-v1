/// <reference types="vite/client" />

declare module '*.css'

type SaunaSnapshot = {
  index: number
  camera: { x: number; y: number; z: number } | null
  targetX: number | null
  rooms: {
    id: string
    name: string
    air: number
    door: boolean
    lock: string
    people: number
    lightsOn: number
    heaterOn: boolean
  }[]
}

interface Window {
  __sauna?: {
    go: (index: number) => void
    toggleDoor: () => void
    toggleLights: () => void
    aim: (x: number, y: number, z: number) => void
    acceptBookings: (payload: unknown) => {
      accepted: number
      updated: number
      cancelled: number
      skipped: number
    }
    useMockBookings: () => void
    snapshot: () => SaunaSnapshot
  }
}
