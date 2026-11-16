/** Auckland wall time. Vercel runs in UTC, so nothing here uses the host timezone. */

export const DEFAULT_ZONE = 'Pacific/Auckland'

export function siteZone() {
  const value = process.env.SITE_TZ?.trim()
  return value || DEFAULT_ZONE
}

type Parts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string) {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, format)
  }
  return format
}

export function zonedParts(instant: Date, timeZone: string): Parts {
  const map: Record<string, string> = {}
  for (const part of formatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  let hour = map.hour ?? '00'
  if (hour === '24') hour = '00'
  return {
    year: map.year ?? '0000',
    month: map.month ?? '01',
    day: map.day ?? '01',
    hour,
    minute: map.minute ?? '00',
    second: map.second ?? '00',
  }
}

export function zonedDate(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Minutes to add to UTC to get the wall clock. NZST is 720, NZDT is 780. */
export function offsetMinutes(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((asUtc - instant.getTime()) / 60_000)
}

export function formatZoned(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone)
  const offset = offsetMinutes(instant, timeZone)
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const hours = String(Math.floor(abs / 60)).padStart(2, '0')
  const minutes = String(abs % 60).padStart(2, '0')
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${hours}:${minutes}`
}

export function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  return utc.toISOString().slice(0, 10)
}

/** The UTC instant for a wall clock on a calendar day. Null if that clock does not exist (DST gap). */
export function wallToInstant(date: string, time: string, timeZone: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const clock = /^(\d{2}):(\d{2})$/.exec(time)
  if (!day || !clock) return null
  const year = Number(day[1])
  const month = Number(day[2])
  const dateNum = Number(day[3])
  const hour = Number(clock[1])
  const minute = Number(clock[2])
  if (month < 1 || month > 12 || dateNum < 1 || dateNum > 31 || hour > 23 || minute > 59) return null
  const guess = new Date(Date.UTC(year, month - 1, dateNum, hour, minute, 0))
  const first = offsetMinutes(guess, timeZone)
  let instant = new Date(guess.getTime() - first * 60_000)
  const second = offsetMinutes(instant, timeZone)
  if (second !== first) instant = new Date(guess.getTime() - second * 60_000)
  const got = zonedParts(instant, timeZone)
  if (got.year !== day[1] || got.month !== day[2] || got.day !== day[3] || got.hour !== clock[1] || got.minute !== clock[2]) {
    return null
  }
  return instant
}
