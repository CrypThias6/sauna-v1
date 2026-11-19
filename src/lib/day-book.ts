import { useSyncExternalStore } from 'react'
import { sessionGate, staffFetch, subscribeSession } from './session'

export type LiveBooking = {
  id: string
  room: string
  start: string
  end: string
  people: number | null
  status: string
  name?: string
  location?: string
}

export type DayBook = {
  connected: boolean
  bookings: LiveBooking[]
  error: string | null
  known: boolean
  updatedAt: number | null
}

const empty: DayBook = { connected: false, bookings: [], error: null, known: false, updatedAt: null }

/** Keep the last list when the new pull failed. A clean pull replaces it and stamps the time. */
export function mergeBook(previous: DayBook, incoming: DayBook, now = Date.now()): DayBook {
  if (!incoming.known) return previous
  if (incoming.error) {
    const keep = previous.bookings.length > 0
    return {
      ...previous,
      bookings: keep ? previous.bookings : incoming.bookings,
      updatedAt: previous.updatedAt,
      known: true,
      connected: incoming.connected || previous.connected,
      error: incoming.error,
    }
  }
  return { ...incoming, error: null, updatedAt: now }
}

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
      location: typeof row.location === 'string' ? row.location : undefined,
    }]
  })
}

async function load(path: string): Promise<DayBook | null> {
  let response: Response
  try {
    response = await staffFetch(path)
  } catch {
    return { connected: false, bookings: [], error: 'Bookings are unavailable.', known: true, updatedAt: null }
  }
  if (response.status === 401) return null
  const body = (await response.json().catch(() => null)) as { connected?: unknown; error?: unknown; bookings?: unknown } | null
  if (!response.ok || !body) return { connected: false, bookings: [], error: 'Bookings are unavailable.', known: true, updatedAt: null }
  return {
    connected: body.connected === true,
    bookings: rows(body),
    error: typeof body.error === 'string' ? body.error : null,
    known: true,
    updatedAt: null,
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

let inflight = false

async function refresh() {
  if (inflight || sessionGate() === 'needed') return
  if (document.visibilityState === 'hidden') return
  inflight = true
  try {
    const date = nzDate()
    const month = date.slice(0, 7)
    const [day, mon] = await Promise.all([load(`/api/bookings?date=${date}`), load(`/api/bookings?month=${month}`)])
    if (day) today = mergeBook(today, day)
    if (mon) monthBook = mergeBook(monthBook, mon)
    if (day || mon) emit()
  } finally {
    inflight = false
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') void refresh()
}

function ensure() {
  if (timer != null) return
  void refresh()
  timer = window.setInterval(() => void refresh(), 60_000)
  document.addEventListener('visibilitychange', onVisible)
  subscribeSession(() => {
    if (sessionGate() === 'in') void refresh()
  })
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
