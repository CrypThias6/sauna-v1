/**
 * Bookings for the schedule and the calendar.
 * SimplyBook when the flag or the keys say so. Otherwise nothing — no sample month.
 * One modest window is shared by the day, the month, and the tick.
 */
import type { Booking } from './booking.js'
import { readBookingCache, writeBookingCache } from './store.js'
import {
  bookingsMode,
  fetchSimplyBooking,
  fetchSimplySpan,
  mapSimplyBooking,
  simplyBookReady,
  simplyBookSnapshot,
} from './simplybook.js'

const WINDOW_MS = 45_000

export type BookingLoad = {
  connected: boolean
  bookings: Booking[]
  error: string | null
}

export type BookingStatus = {
  source: 'simplybook' | 'none'
  authOk: boolean | null
  lastFetch: string | null
  count: number | null
  error: string | null
}

let windowCache: { at: number; bookings: Booking[] } | null = null
let inflight: Promise<Booking[]> | null = null

function bookingError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return message.startsWith('SimplyBook') ? message : 'Bookings are unavailable.'
}

function onDay(bookings: Booking[], date: string) {
  return bookings.filter((booking) => booking.status !== 'cancelled' && booking.start.startsWith(date))
}

function inMonth(bookings: Booking[], month: string) {
  return bookings.filter((booking) => booking.status !== 'cancelled' && booking.start.startsWith(month))
}

async function remember(bookings: Booking[]) {
  windowCache = { at: Date.now(), bookings }
  try {
    await writeBookingCache(bookings)
  } catch {
    // The live list is already in memory. A blob miss must not look like a SimplyBook failure.
  }
}

async function windowBookings(now: Date) {
  if (windowCache && Date.now() - windowCache.at < WINDOW_MS) return windowCache.bookings
  if (!inflight) {
    inflight = fetchSimplySpan(now)
      .then(async (bookings) => {
        await remember(bookings)
        return bookings
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

async function savedBookings() {
  if (windowCache) return windowCache.bookings
  return (await readBookingCache())?.bookings ?? null
}

async function loadWindow(now: Date): Promise<BookingLoad> {
  if (bookingsMode() !== 'simplybook') return { connected: false, bookings: [], error: null }
  if (!simplyBookReady()) return { connected: true, bookings: [], error: 'SimplyBook login is not set.' }
  try {
    return { connected: true, bookings: await windowBookings(now), error: null }
  } catch (error) {
    const stale = await savedBookings()
    const message = bookingError(error)
    if (stale) return { connected: true, bookings: stale, error: message }
    return { connected: true, bookings: [], error: message }
  }
}

export async function loadDay(date: string, now = new Date()): Promise<BookingLoad> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { connected: bookingsMode() === 'simplybook', bookings: [], error: null }
  const loaded = await loadWindow(now)
  if (!loaded.connected) return loaded
  return { ...loaded, bookings: onDay(loaded.bookings, date) }
}

export async function loadMonth(month: string, now = new Date()): Promise<BookingLoad> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { connected: bookingsMode() === 'simplybook', bookings: [], error: null }
  const loaded = await loadWindow(now)
  if (!loaded.connected) return loaded
  return { ...loaded, bookings: inMonth(loaded.bookings, month) }
}

/** Staff-only. No company name, login, token, or key. */
export async function bookingStatus(now = new Date()): Promise<BookingStatus> {
  const source = bookingsMode()
  if (source !== 'simplybook') return { source, authOk: null, lastFetch: null, count: null, error: null }
  if (!simplyBookReady()) return { source, authOk: false, lastFetch: null, count: null, error: 'SimplyBook login is not set.' }
  const current = simplyBookSnapshot()
  const fetched = current.lastFetch ? Date.parse(current.lastFetch) : NaN
  if (!Number.isFinite(fetched) || now.getTime() - fetched > 60_000) await loadWindow(now)
  const next = simplyBookSnapshot()
  return { source, authOk: next.authOk, lastFetch: next.lastFetch, count: next.count, error: next.error }
}

export async function applyWebhookBooking(id: string, cancelled: boolean) {
  const previous = (await readBookingCache())?.bookings ?? windowCache?.bookings ?? []
  if (cancelled) {
    const bookings = previous.filter((booking) => booking.id !== id)
    windowCache = { at: Date.now(), bookings }
    await writeBookingCache(bookings)
    return
  }
  const booking = await fetchSimplyBooking(id)
  const rest = previous.filter((item) => item.id !== id)
  const bookings = booking ? [...rest, booking] : rest
  windowCache = { at: Date.now(), bookings }
  await writeBookingCache(bookings)
}

export function webhookLooksCancelled(notice: string) {
  return /cancel/i.test(notice)
}

export { mapSimplyBooking }
