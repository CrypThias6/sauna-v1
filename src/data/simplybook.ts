/**
 * Loose intake for SimplyBook.me. The preview book stays on screen until
 * acceptBookings() receives something, or until setBookingSource('simplybook').
 * setBookingSource('mock') puts the preview book back. Stored bookings are kept.
 *
 * Accepts one booking, a list, a REST envelope ({ bookings } / { data }),
 * a webhook (new_booking, change_booking, cancel_booking, or the same names
 * under event / notification_type), a JSON string, or a CSV export.
 * Unknown fields are kept. Missing fields are left blank.
 */
import type { Visit } from './bookings'

export type BookingSource = 'mock' | 'simplybook'

export type CalendarEvent = {
  id: string
  start: Date | null
  end: Date | null
  time: string
  minutes: number
  service: string
  provider: string
  client: string
  email: string
  phone: string
  status: string
  notes: string
  people: number
  room: 'Small' | 'Big' | ''
  extra: Record<string, unknown>
}

export type AcceptResult = {
  accepted: number
  updated: number
  cancelled: number
  skipped: number
}

type Listener = () => void

const listeners = new Set<Listener>()
const events = new Map<string, CalendarEvent>()
const cancelledIds = new Set<string>()
let source: BookingSource = 'mock'
let version = 0

const NESTS = ['client', 'customer', 'service', 'event', 'provider', 'unit', 'staff', 'location']
const LIST_KEYS = ['bookings', 'appointments', 'items', 'records', 'results', 'data', 'result']
const ONE_KEYS = ['booking', 'bookingdata', 'appointment', 'data', 'result']

export function bookingSource() {
  return source
}

export function subscribeBookings(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function bookingVersion() {
  return version
}

export function setBookingSource(next: BookingSource) {
  if (source === next) return
  source = next
  touch()
}

export function clearSimplyBook() {
  events.clear()
  cancelledIds.clear()
  source = 'mock'
  touch()
}

export function simplyBookEvents() {
  return [...events.values()]
}

/** Replace or update bookings. A cancel with only an id marks that id cancelled. */
export function acceptBookings(input: unknown): AcceptResult {
  const records = readBookings(input)
  const result: AcceptResult = { accepted: 0, updated: 0, cancelled: 0, skipped: 0 }
  if (records.length === 0) {
    result.skipped = 1
    return result
  }

  for (const record of records) {
    const drafted = eventFrom(record)
    if (!drafted) {
      result.skipped += 1
      continue
    }
    const previous = events.get(drafted.id)
    const next = mergeEvent(previous, drafted)
    if (next.status === 'cancelled') {
      cancelledIds.add(next.id)
      result.cancelled += 1
    } else if (drafted.explicitStatus) {
      cancelledIds.delete(next.id)
    } else if (cancelledIds.has(next.id)) {
      next.status = 'cancelled'
      result.cancelled += 1
    }
    events.set(next.id, next)
    if (previous) result.updated += 1
    else result.accepted += 1
  }

  if ([...events.values()].some((event) => event.start)) source = 'simplybook'
  touch()
  return result
}

export function liveVisitsOn(year: number, monthIndex: number, day: number): Visit[] {
  return [...events.values()]
    .filter((event) => {
      if (!event.start) return false
      return (
        event.start.getFullYear() === year &&
        event.start.getMonth() === monthIndex &&
        event.start.getDate() === day
      )
    })
    .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0))
    .map(toVisit)
}

function toVisit(event: CalendarEvent): Visit {
  const name = event.client || event.service || 'Booking'
  return {
    id: event.id,
    time: event.time,
    minutes: event.minutes,
    room: event.room,
    name,
    people: event.status === 'cancelled' ? 0 : event.people,
    status: event.status,
    service: event.service,
    provider: event.provider,
    email: event.email,
    phone: event.phone,
    notes: event.notes,
  }
}

type Draft = CalendarEvent & { explicitStatus: boolean }

function eventFrom(record: Record<string, unknown>): Draft | null {
  const notice = noticeOf(record)
  const id = text(pick(record, ['id', 'bookingid', 'booking_id', 'code', 'hash']))
  const start = at(
    pick(record, ['startdatetime', 'start_date_time', 'startdate', 'start', 'from', 'datetime', 'date']),
    pick(record, ['starttime', 'start_time', 'time']),
  )
  const end = at(
    pick(record, ['enddatetime', 'end_date_time', 'enddate', 'end', 'to', 'untildate']),
    pick(record, ['endtime', 'end_time', 'until']),
  )
  const duration = minutesOf(pick(record, ['duration', 'durationminutes', 'minutes', 'length']))
  let minutes = 60
  if (start && end && end.getTime() > start.getTime()) {
    minutes = Math.round((end.getTime() - start.getTime()) / 60000)
  } else if (duration != null && duration > 0 && duration <= 24 * 60) {
    minutes = duration
  }
  const service = serviceOf(record)
  const provider = label(pick(record, ['providername', 'provider', 'unitname', 'unit', 'staff', 'performer']))
  const client = label(
    pick(record, ['clientname', 'client', 'customername', 'customer', 'name', 'fullname']),
  )
  const email = text(pick(record, ['clientemail', 'email', 'customeremail']))
  const phone = text(pick(record, ['clientphone', 'phone', 'customerphone', 'mobile']))
  const peopleValue = pick(record, ['count', 'people', 'clients', 'guests', 'qty', 'quantity', 'seats'])
  const people = peopleValue == null ? 1 : Math.max(0, Math.round(numberOf(peopleValue) ?? 1))
  const statusPick = pick(record, ['status', 'bookingstatus', 'state'])
  const explicitStatus =
    statusPick != null ||
    pick(record, ['isconfirmed', 'requireconfirm']) != null ||
    /cancel/.test(notice)
  const status = normalizeStatus(statusPick, notice, record)
  const notes = notesOf(record)
  const room = roomOf(text(pick(record, ['room', 'location', 'locationname'])), provider, service)

  if (!id && !start && !client && !service && !provider && !email) return null

  return {
    id: id || `open-${start?.getTime() ?? 'na'}-${client}-${service}`,
    start,
    end: end && start && end.getTime() > start.getTime() ? end : start ? new Date(start.getTime() + minutes * 60000) : null,
    time: clock(start),
    minutes,
    service,
    provider,
    client,
    email,
    phone,
    status,
    notes,
    people,
    room,
    extra: record,
    explicitStatus,
  }
}

function mergeEvent(previous: CalendarEvent | undefined, next: Draft): CalendarEvent {
  const { explicitStatus, ...incoming } = next
  if (!previous) return incoming

  const event: CalendarEvent = { ...previous, extra: incoming.extra }
  const textKeys = ['service', 'provider', 'client', 'email', 'phone', 'notes', 'time'] as const
  for (const key of textKeys) {
    if (incoming[key]) event[key] = incoming[key]
  }
  if (incoming.room) event.room = incoming.room
  if (incoming.start) event.start = incoming.start
  if (incoming.end) event.end = incoming.end
  if (incoming.minutes > 0 && (incoming.start || incoming.time)) event.minutes = incoming.minutes
  if (explicitStatus) event.status = incoming.status
  if (incoming.people !== 1 || previous.people === 1) event.people = incoming.people
  return event
}

function noticeOf(record: Record<string, unknown>) {
  const raw = text(pick(record, ['notificationtype', 'event', 'action', 'hook', 'webhook']))
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (/cancel|new_booking|change_booking|create_booking|booking_created|booking_changed|booking_cancel/.test(raw)) {
    return raw
  }
  if (['create', 'new', 'change', 'update', 'cancel', 'canceled', 'cancelled'].includes(raw)) return raw
  return ''
}

function serviceOf(record: Record<string, unknown>) {
  const value = pick(record, ['servicename', 'service', 'eventname', 'event'])
  const raw = text(value).toLowerCase().replace(/[\s-]+/g, '_')
  if (/booking/.test(raw) && /cancel|change|create|new/.test(raw)) return ''
  return label(value)
}

function normalizeStatus(statusPick: unknown, notice: string, record: Record<string, unknown>) {
  if (/cancel/.test(notice)) return 'cancelled'
  const raw = label(statusPick).toLowerCase().replace(/[\s-]+/g, '_')
  if (/cancel/.test(raw) || raw === 'deleted' || raw === 'no_show') {
    return raw === 'no_show' ? 'no_show' : 'cancelled'
  }
  if (['pending', 'unconfirmed', 'not_confirmed', 'awaiting', 'awaiting_confirmation'].includes(raw)) {
    return 'pending'
  }
  if (['confirmed', 'confirm', 'approved', 'paid', 'complete', 'completed', 'ok'].includes(raw)) {
    return 'confirmed'
  }
  if (raw) return raw
  const confirmed = pick(record, ['isconfirmed', 'is_confirmed'])
  if (confirmed === 0 || confirmed === '0' || confirmed === false) return 'pending'
  if (truthy(pick(record, ['requireconfirm', 'require_confirm']))) return 'pending'
  if (/new|create/.test(notice)) return 'confirmed'
  return 'confirmed'
}

function roomOf(explicit: string, provider: string, service: string): 'Small' | 'Big' | '' {
  const blob = `${explicit} ${provider} ${service}`.toLowerCase()
  if (/\bsmall\b/.test(blob)) return 'Small'
  if (/\bbig\b/.test(blob)) return 'Big'
  return ''
}

function notesOf(record: Record<string, unknown>) {
  const direct = pick(record, ['notes', 'note', 'comment', 'clientcomment', 'comments', 'description'])
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const extra = pick(record, ['additional', 'additionalfields', 'customfields'])
  if (typeof extra === 'string') return extra.trim()
  if (!isRecord(extra)) return ''
  return Object.entries(extra)
    .map(([key, value]) => {
      const line = label(value)
      return line ? `${key}: ${line}` : ''
    })
    .filter(Boolean)
    .join('; ')
}

export function readBookings(input: unknown): Record<string, unknown>[] {
  const value = unwrap(input)
  if (Array.isArray(value)) return value.flatMap(oneBooking)
  if (!isRecord(value)) return []
  for (const key of LIST_KEYS) {
    const nested = field(value, key)
    if (Array.isArray(nested)) return nested.flatMap(oneBooking)
  }
  return oneBooking(value)
}

function oneBooking(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return []
  for (const key of ONE_KEYS) {
    const nested = field(value, key)
    if (isRecord(nested) && looksLikeBooking(nested)) return [withNotice(value, nested)]
  }
  return looksLikeBooking(value) ? [value] : []
}

function withNotice(envelope: Record<string, unknown>, booking: Record<string, unknown>) {
  const notice = pick(envelope, ['notificationtype', 'event', 'action', 'hook', 'webhook'])
  if (notice == null) return booking
  if (pick(booking, ['notificationtype', 'event', 'action']) != null) return booking
  return { ...booking, notification_type: notice }
}

function looksLikeBooking(record: Record<string, unknown>) {
  const keys = new Set([...index(record).keys()])
  return [
    'id',
    'bookingid',
    'code',
    'hash',
    'startdatetime',
    'startdate',
    'starttime',
    'date',
    'time',
    'client',
    'clientname',
    'service',
    'servicename',
    'eventid',
    'provider',
    'unit',
    'status',
    'isconfirmed',
  ].some((key) => keys.has(key))
}

function pick(record: Record<string, unknown>, keys: string[]) {
  const map = index(record)
  for (const key of keys) {
    const norm = normKey(key)
    if (!map.has(norm)) continue
    const value = map.get(norm)
    if (value == null || value === '') continue
    return value
  }
  return undefined
}

function index(record: Record<string, unknown>) {
  const map = new Map<string, unknown>()
  const add = (prefix: string, source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      const norm = normKey(prefix + key)
      if (value != null && value !== '' && !map.has(norm)) map.set(norm, value)
    }
  }
  add('', record)
  for (const nest of NESTS) {
    const value = field(record, nest)
    if (!isRecord(value)) continue
    add(nest, value)
    if (nest === 'client' || nest === 'customer') {
      for (const key of ['name', 'email', 'phone']) {
        if (value[key] != null && value[key] !== '' && !map.has(key)) map.set(key, value[key])
      }
    }
  }
  return map
}

function field(record: Record<string, unknown>, key: string) {
  const want = normKey(key)
  for (const [name, value] of Object.entries(record)) {
    if (normKey(name) === want) return value
  }
  return undefined
}

function normKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function unwrap(input: unknown): unknown {
  if (typeof input !== 'string') return input
  const trimmed = input.trim()
  if (!trimmed) return input
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      return input
    }
  }
  if (trimmed.includes(',') && /[\n\r]/.test(trimmed)) return parseCsv(trimmed)
  return input
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      if (row.some((part) => part.trim())) rows.push(row)
      row = []
      continue
    }
    cell += char
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    if (row.some((part) => part.trim())) rows.push(row)
  }
  if (rows.length < 2) return []
  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).map((parts) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (header) record[header] = (parts[index] ?? '').trim()
    })
    return record
  })
}

function at(dateValue: unknown, timeValue: unknown) {
  const date = parseWhen(dateValue)
  if (!date) return null
  const timeRaw = text(timeValue)
  if (!timeRaw || hasClock(dateValue)) return date
  const clockMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(timeRaw)
  if (!clockMatch) return date
  let hour = Number(clockMatch[1])
  const minute = Number(clockMatch[2])
  const second = Number(clockMatch[3] ?? 0)
  const suffix = clockMatch[4]?.toLowerCase()
  if (suffix === 'pm' && hour < 12) hour += 12
  if (suffix === 'am' && hour === 12) hour = 0
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, second)
}

function hasClock(value: unknown) {
  if (typeof value === 'number') return true
  return /[T\s]\d{1,2}:\d{2}/.test(text(value))
}

function parseWhen(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const raw = text(value)
  if (!raw) return null
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(raw)
  if (iso) {
    return new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4] ?? 0),
      Number(iso[5] ?? 0),
      Number(iso[6] ?? 0),
    )
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i.exec(raw)
  if (us) {
    let hour = Number(us[4] ?? 0)
    const suffix = us[7]?.toLowerCase()
    if (suffix === 'pm' && hour < 12) hour += 12
    if (suffix === 'am' && hour === 12) hour = 0
    return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]), hour, Number(us[5] ?? 0), Number(us[6] ?? 0))
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function minutesOf(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 24 * 60 && value < 7 * 24 * 60 * 60) return Math.round(value / 60)
    return Math.round(value)
  }
  const raw = text(value)
  if (!raw) return null
  const clockMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw)
  if (clockMatch) return Number(clockMatch[1]) * 60 + Number(clockMatch[2])
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function clock(date: Date | null) {
  if (!date) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function numberOf(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(text(value))
  return Number.isFinite(parsed) ? parsed : null
}

function label(value: unknown): string {
  if (isRecord(value)) {
    return text(value.name ?? value.title ?? value.label ?? value.full_name ?? value.fullname)
  }
  return text(value)
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

function truthy(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function touch() {
  version += 1
  listeners.forEach((listener) => listener())
}
