/**
 * Light schedule for one minute of the day.
 * No Vercel imports: an on-site box can cache the day's bookings and settings
 * and call this while Starlink is down, then talk to WLED or Shelly on the LAN.
 * A fallback, if Tim confirms it, is one Piqo timed-sequence Action per booking
 * instead of a tick every minute.
 * The sensor reading is not an input and must not become one.
 */
import type { Booking } from './booking.js'
import { addCalendarDays, formatZoned, wallToInstant, zonedDate } from './time.js'

export const CATCH_UP_MS = 5 * 60 * 1000

export type ScheduledAction = 'Glow on' | 'Glow off' | 'Outdoor on' | 'Outdoor off' | 'Gentle flash'

export type ScheduleSettings = {
  outdoorOn: string
  outdoorOff: string
  flashIntervalMin: number
}

export type ScheduleEvent = {
  /** 2026-11-16-<bookingId>:flash:30, or 2026-11-16:outdoor:on. */
  key: string
  at: string
  action: ScheduledAction
}

export type SentLog = {
  read(): Promise<readonly string[]>
  write(keys: readonly string[]): Promise<void>
}

function clock(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

function intervalMinutes(value: number) {
  if (!Number.isFinite(value)) return 15
  return Math.min(180, Math.max(1, Math.round(value)))
}

function isDue(at: string, now: Date, windowMs: number) {
  const when = Date.parse(at)
  if (!Number.isFinite(when)) return false
  const age = now.getTime() - when
  return age >= 0 && age <= windowMs
}

function bookingEvents(booking: Booking, zone: string, intervalMin: number): ScheduleEvent[] {
  if (booking.status !== 'confirmed') return []
  if (booking.room !== 'Small' && booking.room !== 'Big') return []
  const startMs = Date.parse(booking.start)
  const endMs = Date.parse(booking.end)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return []
  const id = booking.id.trim()
  if (!id) return []
  const events: ScheduleEvent[] = []
  const start = new Date(startMs)
  events.push({
    key: `${zonedDate(start, zone)}-${id}:glow:on`,
    at: formatZoned(start, zone),
    action: 'Glow on',
  })
  const step = intervalMin * 60_000
  for (let mark = startMs + step; mark < endMs; mark += step) {
    const at = new Date(mark)
    const minutes = Math.round((mark - startMs) / 60_000)
    events.push({
      key: `${zonedDate(at, zone)}-${id}:flash:${minutes}`,
      at: formatZoned(at, zone),
      action: 'Gentle flash',
    })
    if (events.length > 200) break
  }
  const end = new Date(endMs)
  events.push({
    key: `${zonedDate(end, zone)}-${id}:glow:off`,
    at: formatZoned(end, zone),
    action: 'Glow off',
  })
  return events
}

function outdoorEvents(date: string, settings: ScheduleSettings, zone: string): ScheduleEvent[] {
  const on = clock(settings.outdoorOn)
  const off = clock(settings.outdoorOff)
  if (!on || !off || on === off) return []
  const onAt = wallToInstant(date, on, zone)
  if (!onAt) return []
  const offDate = off > on ? date : addCalendarDays(date, 1)
  const offAt = wallToInstant(offDate, off, zone)
  if (!offAt) return []
  return [
    { key: `${zonedDate(onAt, zone)}:outdoor:on`, at: formatZoned(onAt, zone), action: 'Outdoor on' },
    { key: `${zonedDate(offAt, zone)}:outdoor:off`, at: formatZoned(offAt, zone), action: 'Outdoor off' },
  ]
}

/** Dates whose bookings a tick should load so a mark just after midnight is still inside the window. */
export function bookingDates(now: Date, windowMs = CATCH_UP_MS, timeZone = 'Pacific/Auckland') {
  const today = zonedDate(now, timeZone)
  const touched = zonedDate(new Date(now.getTime() - windowMs), timeZone)
  return [...new Set([addCalendarDays(today, -1), touched, today])]
}

/**
 * Events whose time is inside the last `windowMs` (default 5 minutes).
 * Older marks are left behind. Nothing in the future is included.
 */
export function dueEvents(input: {
  now: Date
  bookings: readonly Booking[]
  settings: ScheduleSettings
  timeZone?: string
  windowMs?: number
}): ScheduleEvent[] {
  const zone = input.timeZone || 'Pacific/Auckland'
  const windowMs = input.windowMs ?? CATCH_UP_MS
  const interval = intervalMinutes(input.settings.flashIntervalMin)
  const seen = new Set<string>()
  const events: ScheduleEvent[] = []
  const take = (event: ScheduleEvent) => {
    if (!isDue(event.at, input.now, windowMs) || seen.has(event.key)) return
    seen.add(event.key)
    events.push(event)
  }
  const today = zonedDate(input.now, zone)
  const dates = new Set([today, zonedDate(new Date(input.now.getTime() - windowMs), zone), addCalendarDays(today, -1)])
  for (const date of dates) {
    for (const event of outdoorEvents(date, input.settings, zone)) take(event)
  }
  for (const booking of input.bookings) {
    for (const event of bookingEvents(booking, zone, interval)) take(event)
  }
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.key.localeCompare(b.key)))
  return events
}

/** Drop keys older than two days before `today`, then add the ones just fired. */
export function mergeSent(existing: readonly string[], fresh: readonly string[], today: string) {
  const keepFrom = addCalendarDays(today, -2)
  return [...new Set([...existing, ...fresh])].filter((key) => key.slice(0, 10) >= keepFrom)
}

/**
 * Fire due events that are not already in the sent log, then record them.
 * The log is not read when nothing is due.
 */
export async function runTick(input: {
  now: Date
  bookings: readonly Booking[]
  settings: ScheduleSettings
  timeZone?: string
  windowMs?: number
  sent: SentLog
  fire(event: ScheduleEvent): Promise<void>
}): Promise<{ fired: ScheduleEvent[]; readLog: boolean; wroteLog: boolean }> {
  const due = dueEvents(input)
  if (due.length === 0) return { fired: [], readLog: false, wroteLog: false }
  const existing = await input.sent.read()
  const seen = new Set(existing)
  const fresh = due.filter((event) => !seen.has(event.key))
  if (fresh.length === 0) return { fired: [], readLog: true, wroteLog: false }
  for (const event of fresh) await input.fire(event)
  const zone = input.timeZone || 'Pacific/Auckland'
  await input.sent.write(mergeSent(existing, fresh.map((event) => event.key), zonedDate(input.now, zone)))
  return { fired: fresh, readLog: true, wroteLog: true }
}
