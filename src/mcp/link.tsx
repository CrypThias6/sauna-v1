import { useEffect, useRef } from 'react'
import { visitsOn } from '../data/bookings'
import { useSauna } from '../state/store'
import type { Sauna } from '../types'

type Command = {
  id: string
  name: string
  args: Record<string, unknown>
}

let listening = false
const listeners = new Set<() => void>()

export function bridgeListening() {
  return listening
}

export function subscribeBridge(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setListening(next: boolean) {
  if (listening === next) return
  listening = next
  listeners.forEach((listener) => listener())
}

function roomId(value: unknown) {
  const name = String(value ?? '').toLowerCase()
  if (name === 'small' || name === 'big') return name
  return null
}

function dayPeople(sauna: Sauna, year: number, month: number, day: number, today: number) {
  if (day === today) return sauna.occupants.length
  return visitsOn(year, month, day).reduce((sum, visit) => sum + visit.people, 0)
}

function snapshot(saunas: Sauna[], index: number) {
  const showing = saunas[index]
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return {
    showing: showing?.id ?? null,
    rooms: saunas.map((sauna) => ({
      id: sauna.id,
      name: sauna.name,
      people: sauna.occupants.length,
      capacity: sauna.capacity,
      airC: Math.round(sauna.airC * 10) / 10,
      targetC: Math.round(sauna.targetC),
      doorOpen: sauna.doorOpen,
      lock: sauna.lock,
      heaterOn: sauna.heaterOn,
      lightsOn: sauna.lights.filter((light) => light.on).length,
      lights: sauna.lights.length,
      session: sauna.session.mode,
      sessionActive: sauna.session.active,
      endsInMin: Math.max(0, Math.ceil(sauna.session.endsInMin)),
      water: sauna.water,
    })),
    calendar: {
      month: now.toLocaleDateString('en-GB', { month: 'long' }),
      year,
      today,
      inRoom: showing?.occupants.length ?? 0,
      days: Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        people: showing ? dayPeople(showing, year, month, i + 1, today) : 0,
      })),
    },
  }
}

function run(command: Command, api: ReturnType<typeof useSauna>) {
  const id = roomId(command.args.room)
  if (command.name !== 'switch_sauna' && !id) return { ok: false, error: 'Name the room small or big.' }
  if (command.name === 'set_heat') {
    const celsius = Number(command.args.celsius)
    if (!Number.isFinite(celsius)) return { ok: false, error: 'celsius must be a number.' }
    api.setTarget(id as string, Math.max(40, Math.min(100, Math.round(celsius))))
    return { ok: true }
  }
  if (command.name === 'set_door') {
    api.setDoor(id as string, Boolean(command.args.open))
    return { ok: true }
  }
  if (command.name === 'set_lock') {
    api.setLock(id as string, Boolean(command.args.locked))
    return { ok: true }
  }
  if (command.name === 'set_heater') {
    api.setHeater(id as string, Boolean(command.args.on))
    return { ok: true }
  }
  if (command.name === 'set_lights') {
    api.setLights(id as string, Boolean(command.args.on))
    return { ok: true }
  }
  if (command.name === 'switch_sauna') {
    const next = roomId(command.args.room)
    const index = api.saunas.findIndex((sauna) => sauna.id === next)
    if (index < 0) return { ok: false, error: 'Name the room small or big.' }
    api.setIndex(index)
    return { ok: true }
  }
  return { ok: false, error: 'Unknown command.' }
}

/** Keeps the local MCP endpoint in step with this page. */
export function RemoteLink() {
  const api = useSauna()
  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    const stop = new AbortController()
    const postState = () => {
      const { saunas, index } = apiRef.current
      return fetch('/sauna-bridge/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(snapshot(saunas, index)),
        signal: stop.signal,
      })
    }
    const loop = async () => {
      while (!stop.signal.aborted) {
        try {
          await postState()
          setListening(true)
          const pulled = await fetch('/sauna-bridge/pull', { signal: stop.signal })
          if (pulled.status === 204) continue
          const command = (await pulled.json()) as Command
          const result = run(command, apiRef.current)
          await fetch('/sauna-bridge/reply', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: command.id, result }),
            signal: stop.signal,
          })
        } catch {
          if (stop.signal.aborted) return
          setListening(false)
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }
    }
    void loop()
    return () => stop.abort()
  }, [])

  return null
}
