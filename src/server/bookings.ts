/**
 * BookingsSource. MockBookings reads the preview book.
 * SimplyBookBookings throws until Tim wires the HTTP call, then the body goes through acceptBookings().
 */
import { previewVisitsOn, type Visit } from '../data/bookings.js'
import { acceptBookings, liveVisitsOn } from '../data/simplybook.js'
import type { Booking, BookingsSource } from './booking.js'
import { formatZoned, siteZone, wallToInstant } from './time.js'

function visitToBooking(date: string, visit: Visit, zone: string): Booking | null {
  if (visit.room !== 'Small' && visit.room !== 'Big') return null
  if (visit.status === 'cancelled' || visit.status === 'no_show') return null
  if (!visit.time.includes(':') || visit.minutes <= 0) return null
  const [hour, minute] = visit.time.split(':')
  if (!hour || minute == null) return null
  const start = wallToInstant(date, `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`, zone)
  if (!start) return null
  const end = new Date(start.getTime() + visit.minutes * 60_000)
  return {
    id: visit.id,
    room: visit.room,
    start: formatZoned(start, zone),
    end: formatZoned(end, zone),
    people: visit.people,
    status: 'confirmed',
    name: visit.name || undefined,
  }
}

export class MockBookings implements BookingsSource {
  async listDay(date: string): Promise<Booking[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
    const [year, month, day] = date.split('-').map(Number)
    const zone = siteZone()
    return previewVisitsOn(year, month - 1, day).flatMap((visit) => {
      const booking = visitToBooking(date, visit, zone)
      return booking ? [booking] : []
    })
  }
}

export class SimplyBookBookings implements BookingsSource {
  async listDay(date: string): Promise<Booking[]> {
    const raw = await pullDay(date)
    acceptBookings(raw)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
    const [year, month, day] = date.split('-').map(Number)
    const zone = siteZone()
    return liveVisitsOn(year, month - 1, day).flatMap((visit) => {
      const booking = visitToBooking(date, visit, zone)
      return booking ? [booking] : []
    })
  }
}

async function pullDay(_date: string): Promise<unknown> {
  const company = process.env.SIMPLYBOOK_COMPANY?.trim() ?? ''
  const apiKey = process.env.SIMPLYBOOK_API_KEY?.trim() ?? ''
  const secret = process.env.SIMPLYBOOK_SECRET?.trim() ?? ''
  if (!company || !apiKey || !secret) throw new Error('not configured')
  // TODO(Tim): request this civil day from SimplyBook and return the raw body.
  // Do not guess the path. acceptBookings() above is the parser.
  throw new Error('not configured')
}

export function bookingsSource(): BookingsSource {
  const name = (process.env.BOOKINGS_SOURCE || 'mock').trim().toLowerCase()
  if (name === 'simplybook') return new SimplyBookBookings()
  return new MockBookings()
}
