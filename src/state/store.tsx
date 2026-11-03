import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { initialSaunas } from '../data/saunas'
import { stepSauna } from '../lib/sim'
import type { Occupant, Sauna } from '../types'

type Store = {
  saunas: Sauna[]
  index: number
  now: number
  cameraId: string | null
  setIndex: (index: number) => void
  openCamera: (id: string) => void
  closeCamera: () => void
  setTarget: (id: string, celsius: number) => void
  setDoor: (id: string, open: boolean) => void
  setLock: (id: string, locked: boolean) => void
  setHeater: (id: string, on: boolean) => void
  setLights: (id: string, on: boolean) => void
  removeOccupant: (id: string, personId: string) => void
  addOccupant: (id: string, person: Occupant) => void
  toggleDoor: (id: string) => void
  toggleLock: (id: string) => void
  toggleHeater: (id: string) => void
  toggleLights: (id: string) => void
}

const SaunaContext = createContext<Store | null>(null)

function patch(list: Sauna[], id: string, update: (sauna: Sauna) => Sauna) {
  return list.map((sauna) => (sauna.id === id ? update(sauna) : sauna))
}

export function SaunaProvider({ children }: { children: ReactNode }) {
  const [saunas, setSaunas] = useState(initialSaunas)
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [cameraId, setCameraId] = useState<string | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
      setSaunas((list) => list.map((sauna) => stepSauna(sauna)))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const api = useMemo<Store>(() => {
    return {
      saunas,
      index,
      now,
      cameraId,
      setIndex,
      openCamera: setCameraId,
      closeCamera: () => setCameraId(null),
      setTarget: (id, celsius) =>
        setSaunas((list) => patch(list, id, (sauna) => ({ ...sauna, targetC: celsius }))),
      setDoor: (id, open) =>
        setSaunas((list) =>
          patch(list, id, (sauna) =>
            open ? { ...sauna, doorOpen: true, lock: 'unlocked' } : { ...sauna, doorOpen: false },
          ),
        ),
      setLock: (id, locked) =>
        setSaunas((list) =>
          patch(list, id, (sauna) =>
            locked ? { ...sauna, lock: 'locked', doorOpen: false } : { ...sauna, lock: 'unlocked' },
          ),
        ),
      setHeater: (id, on) =>
        setSaunas((list) => patch(list, id, (sauna) => ({ ...sauna, heaterOn: on }))),
      setLights: (id, on) =>
        setSaunas((list) =>
          patch(list, id, (sauna) => ({
            ...sauna,
            lights: sauna.lights.map((light) => ({ ...light, on })),
          })),
        ),
      removeOccupant: (id, personId) =>
        setSaunas((list) =>
          patch(list, id, (sauna) => ({
            ...sauna,
            occupants: sauna.occupants.filter((person) => person.id !== personId),
          })),
        ),
      addOccupant: (id, person) =>
        setSaunas((list) =>
          patch(list, id, (sauna) => {
            if (sauna.occupants.length >= sauna.capacity) return sauna
            if (sauna.occupants.some((item) => item.id === person.id)) return sauna
            const taken = new Set(sauna.occupants.map((item) => item.slot))
            const slot = taken.has(person.slot)
              ? sauna.slots.find((item) => !taken.has(item.id))
              : sauna.slots.find((item) => item.id === person.slot)
            if (!slot) return sauna
            return {
              ...sauna,
              occupants: [...sauna.occupants, { ...person, slot: slot.id, zone: slot.zone }],
            }
          }),
        ),
      toggleDoor: (id) =>
        setSaunas((list) =>
          patch(list, id, (sauna) =>
            sauna.doorOpen
              ? { ...sauna, doorOpen: false }
              : { ...sauna, doorOpen: true, lock: 'unlocked' },
          ),
        ),
      toggleLock: (id) =>
        setSaunas((list) =>
          patch(list, id, (sauna) =>
            sauna.lock === 'locked'
              ? { ...sauna, lock: 'unlocked' }
              : { ...sauna, lock: 'locked', doorOpen: false },
          ),
        ),
      toggleHeater: (id) =>
        setSaunas((list) => patch(list, id, (sauna) => ({ ...sauna, heaterOn: !sauna.heaterOn }))),
      toggleLights: (id) =>
        setSaunas((list) =>
          patch(list, id, (sauna) => {
            const anyOn = sauna.lights.some((light) => light.on)
            return { ...sauna, lights: sauna.lights.map((light) => ({ ...light, on: !anyOn })) }
          }),
        ),
    }
  }, [saunas, index, now, cameraId])

  return <SaunaContext.Provider value={api}>{children}</SaunaContext.Provider>
}

export function useSauna() {
  const store = useContext(SaunaContext)
  if (!store) throw new Error('useSauna must be used inside SaunaProvider')
  return store
}
