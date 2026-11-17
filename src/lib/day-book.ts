import { useSyncExternalStore } from 'react'

export type LiveBooking = {
  id: string
  room: string
  start: string
  end: string
  people: number | null
  status: string
  name?: string
}

export type DayBook = {
  connected: boolean
  bookings: LiveBooking[]
  error: string | null
  known: boolean
}

const empty: DayBook = { connected: false, bookings: [], error: null, known: false }
let today = empty
let monthBook: DayBook = empty
const listeners = new Set<() => void>()
let timer: number | null = null

function emit() {
  for (const listener of listeners) listener()
}

function rows(value: unknown): LiveBooking[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { bookings?: unknown }).bookings)) return []
  return (value as { bookings: unknown[] }).bookings.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Partial<LiveBooking>
    if (typeof row.id !== 'string' || typeof row.start !== 'string' || typeof row.end !== 'string') return []
    return [{
      id: row.id,
      room: typeof row.room === 'string' ? row.room : '',
      start: row.start,
      end: row.end,
      people: typeof row.people === 'number' && Number.isFinite(row.people) ? row.people : null,
      status: typeof row.status === 'string' ? row.status : 'confirmed',
      name: typeof row.name === 'string' ? row.name : undefined,
    }]
  })
}

async function load(path: string) {
  const response = await fetch(path, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
  if (response.status === 401) return null
  const body = (await response.json().catch(() => null)) as { connected?: unknown; error?: unknown; bookings?: unknown } | null
  if (!response.ok || !body) return { connected: false, bookings: [] as LiveBooking[], error: 'Bookings are unavailable.', known: true }
  return {
    connected: body.connected === true,
    bookings: rows(body),
    error: typeof body.error === 'string' ? body.error : null,
    known: true,
  }
}

function nzDate(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now))
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

async function refresh() {
  const date = nzDate()
  const month = date.slice(0, 7)
  const [day, mon] = await Promise.all([load(`/api/bookings?date=${date}`), load(`/api/bookings?month=${month}`)])
  if (day) today = day
  if (mon) monthBook = mon
  emit()
}

function ensure() {
  if (timer != null) return
  void refresh()
  timer = window.setInterval(() => void refresh(), 3 * 60 * 1000)
}

export function getTodayBook() {
  return today
}

export function getMonthBook() {
  return monthBook
}

export function subscribeBook(listener: () => void) {
  listeners.add(listener)
  ensure()
  return () => listeners.delete(listener)
}

export function useTodayBook() {
  return useSyncExternalStore(subscribeBook, getTodayBook, () => empty)
}

export function useMonthBook() {
  return useSyncExternalStore(subscribeBook, getMonthBook, () => empty)
}
