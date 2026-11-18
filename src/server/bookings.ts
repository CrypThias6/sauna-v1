/**
 * Bookings for the schedule and the calendar.
 * SimplyBook when it is configured. Otherwise nothing — no sample month.
 */
import type { Booking } from './booking.js'
import { readBookingCache, writeBookingCache } from './store.js'
import { fetchSimplyBooking, fetchSimplyDay, fetchSimplyMonth, mapSimplyBooking, simplyBookConfigured } from './simplybook.js'

const CACHE_MS = 3 * 60 * 1000

export type BookingLoad = {
  connected: boolean
  bookings: Booking[]
  error: string | null
}

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

async function cached(maxAge: number) {
  const cache = await readBookingCache()
  if (!cache) return null
  if (Date.now() - cache.at > maxAge) return null
  return cache.bookings
}

export async function loadDay(date: string): Promise<BookingLoad> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { connected: simplyBookConfigured(), bookings: [], error: null }
  if (!simplyBookConfigured()) return { connected: false, bookings: [], error: null }
  const fresh = await cached(CACHE_MS)
  if (fresh) return { connected: true, bookings: onDay(fresh, date), error: null }
  try {
    const bookings = await fetchSimplyDay(date)
    const previous = (await readBookingCache())?.bookings ?? []
    const rest = previous.filter((booking) => !booking.start.startsWith(date))
    await writeBookingCache([...rest, ...bookings])
    return { connected: true, bookings, error: null }
  } catch (error) {
    const stale = (await readBookingCache())?.bookings
    if (stale) return { connected: true, bookings: onDay(stale, date), error: null }
    return { connected: true, bookings: [], error: bookingError(error) }
  }
}

export async function loadMonth(month: string): Promise<BookingLoad> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { connected: simplyBookConfigured(), bookings: [], error: null }
  if (!simplyBookConfigured()) return { connected: false, bookings: [], error: null }
  const fresh = await cached(CACHE_MS)
  if (fresh) return { connected: true, bookings: inMonth(fresh, month), error: null }
  try {
    const bookings = await fetchSimplyMonth(month)
    await writeBookingCache(bookings)
    return { connected: true, bookings, error: null }
  } catch (error) {
    const stale = (await readBookingCache())?.bookings
    if (stale) return { connected: true, bookings: inMonth(stale, month), error: null }
    return { connected: true, bookings: [], error: bookingError(error) }
  }
}

export async function applyWebhookBooking(id: string, cancelled: boolean) {
  const previous = (await readBookingCache())?.bookings ?? []
  if (cancelled) {
    await writeBookingCache(previous.filter((booking) => booking.id !== id))
    return
  }
  const booking = await fetchSimplyBooking(id)
  const rest = previous.filter((item) => item.id !== id)
  await writeBookingCache(booking ? [...rest, booking] : rest)
}

export function webhookLooksCancelled(notice: string) {
  return /cancel/i.test(notice)
}

export { mapSimplyBooking }
