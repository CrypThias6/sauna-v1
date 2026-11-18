/**
 * SimplyBook Admin REST (user-api-v2).
 * Auth: POST /admin/auth. Bookings: GET /admin/bookings and GET /admin/bookings/{id}.
 * Times without a zone are read as Pacific/Auckland wall time.
 */
import type { Booking } from './booking.js'
import { formatZoned, wallToInstant } from './time.js'

const ZONE = 'Pacific/Auckland'

export function simplyBookConfigured() {
  return Boolean(company() && login() && password())
}

function company() {
  return process.env.SIMPLYBOOK_COMPANY?.trim() ?? ''
}

function login() {
  return process.env.SIMPLYBOOK_USER_LOGIN?.trim() || company()
}

function password() {
  return (
    process.env.SIMPLYBOOK_USER_PASSWORD?.trim() ||
    process.env.SIMPLYBOOK_USER_KEY?.trim() ||
    process.env.SIMPLYBOOK_API_KEY?.trim() ||
    ''
  )
}

function baseUrl() {
  return (process.env.SIMPLYBOOK_API_URL || 'https://user-api-v2.simplybook.me').replace(/\/$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (isRecord(value)) return text(value.name ?? value.title ?? value.label)
  return ''
}

function firstName(value: string) {
  const word = value.split(/\s+/)[0]
  return word || undefined
}

function peopleOf(record: Record<string, unknown>): number | null {
  for (const key of ['count', 'people', 'participants', 'participant_count', 'qty', 'quantity']) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value))
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Math.max(0, Math.round(Number(value)))
  }
  return null
}

function statusOf(value: unknown): 'confirmed' | 'cancelled' {
  const raw = text(value).toLowerCase().replace(/[\s-]+/g, '_')
  if (/cancel/.test(raw)) return 'cancelled'
  return 'confirmed'
}

function roomOf(record: Record<string, unknown>): 'Small' | 'Big' {
  const blob = [record.service, record.service_name, record.provider, record.provider_name, record.unit, record.location, record.event]
    .map(text)
    .join(' ')
    .toLowerCase()
  if (/\bsmall\b/.test(blob)) return 'Small'
  return 'Big'
}

function wall(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const parsed = Date.parse(raw)
    return Number.isFinite(parsed) ? formatZoned(new Date(parsed), ZONE) : null
  }
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(raw)
  if (!match) return null
  const instant = wallToInstant(match[1], match[2], ZONE)
  return instant ? formatZoned(instant, ZONE) : null
}

/** Map one SimplyBook booking. Cancelled rows are dropped. */
export function mapSimplyBooking(input: unknown): Booking | null {
  if (!isRecord(input)) return null
  const record = isRecord(input.booking) ? input.booking : input
  const status = statusOf(record.status ?? record.booking_status)
  if (status === 'cancelled') return null
  const start = wall(record.start_datetime ?? record.start ?? record.from)
  const end = wall(record.end_datetime ?? record.end ?? record.to)
  if (!start || !end || Date.parse(end) <= Date.parse(start)) return null
  const id = text(record.id ?? record.booking_id ?? record.code)
  if (!id) return null
  const client = text(record.client_name ?? record.client ?? record.name)
  const service = text(record.service_name ?? record.service ?? record.event)
  return {
    id,
    room: roomOf(record),
    start,
    end,
    people: peopleOf(record),
    status,
    name: firstName(client) || service || undefined,
  }
}

export function mapSimplyBookings(input: unknown): Booking[] {
  const rows = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.data)
      ? input.data
      : isRecord(input) && Array.isArray(input.bookings)
        ? input.bookings
        : []
  return rows.flatMap((row) => {
    const booking = mapSimplyBooking(row)
    return booking ? [booking] : []
  })
}

let token = ''
let tokenAt = 0

function detailFrom(body: unknown): string {
  if (!isRecord(body)) return ''
  if (typeof body.message === 'string') return body.message
  if (typeof body.error === 'string') return body.error
  if (isRecord(body.error) && typeof body.error.message === 'string') return body.error.message
  if (Array.isArray(body.errors) && isRecord(body.errors[0]) && typeof body.errors[0].message === 'string') return body.errors[0].message
  return ''
}

/** A short SimplyBook message safe to show and log. Drops anything that looks like a credential. */
export function simplyBookProblem(kind: 'auth' | 'bookings', status: number, body?: unknown) {
  const detail = detailFrom(body).replace(/\s+/g, ' ').trim()
  const safe = detail && detail.length <= 140 && !/[A-Za-z0-9+/=_-]{24,}/.test(detail) && !/(password|secret|token|api[_ ]?key)\s*[:=]/i.test(detail) ? detail : ''
  if (kind === 'auth' && status === 0) return safe ? `SimplyBook login did not return a token. ${safe}` : 'SimplyBook login did not return a token.'
  const head = kind === 'auth'
    ? status === 401 || status === 403
      ? `SimplyBook refused the login (${status}).`
      : `SimplyBook login failed (${status}).`
    : status === 401 || status === 403
      ? `SimplyBook refused the bookings request (${status}).`
      : `SimplyBook bookings failed (${status}).`
  return safe ? `${head} ${safe}` : head
}

function unreachable(kind: 'auth' | 'bookings', error: unknown) {
  const name = error instanceof Error ? error.name : ''
  const timedOut = name === 'TimeoutError' || name === 'AbortError'
  if (kind === 'auth') return timedOut ? 'SimplyBook login timed out.' : 'SimplyBook login could not be reached.'
  return timedOut ? 'SimplyBook bookings timed out.' : 'SimplyBook bookings could not be reached.'
}

function fail(message: string): never {
  console.error(message)
  throw new Error(message)
}

async function authorize(force = false) {
  if (!force && token && Date.now() - tokenAt < 30 * 60 * 1000) return token
  let response: Response
  try {
    response = await fetch(`${baseUrl()}/admin/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ company: company(), login: login(), password: password() }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    token = ''
    fail(unreachable('auth', error))
  }
  const body = (await response.json().catch(() => null)) as { token?: unknown } | null
  if (!response.ok || typeof body?.token !== 'string' || !body.token) {
    token = ''
    fail(simplyBookProblem('auth', response.ok ? 0 : response.status, body))
  }
  token = body.token
  tokenAt = Date.now()
  console.info('SimplyBook auth ok')
  return token
}

async function adminGet(path: string) {
  const headers = (auth: string) => ({
    accept: 'application/json',
    'x-company-login': company(),
    'x-token': auth,
    'x-user-token': auth,
  })
  let auth = await authorize()
  let response: Response
  try {
    response = await fetch(`${baseUrl()}${path}`, { headers: headers(auth), signal: AbortSignal.timeout(15_000) })
    if (response.status === 401) {
      auth = await authorize(true)
      response = await fetch(`${baseUrl()}${path}`, { headers: headers(auth), signal: AbortSignal.timeout(15_000) })
    }
  } catch (error) {
    fail(unreachable('bookings', error))
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) fail(simplyBookProblem('bookings', response.status, body))
  const rows = Array.isArray(body)
    ? body.length
    : isRecord(body) && Array.isArray(body.data)
      ? body.data.length
      : isRecord(body) && Array.isArray(body.bookings)
        ? body.bookings.length
        : 0
  console.info(`SimplyBook bookings ok (${rows})`)
  return body
}

export async function fetchSimplyDay(date: string) {
  const params = new URLSearchParams()
  params.set('on_page', '200')
  params.set('filter[date]', date)
  params.set('filter[date_from]', date)
  params.set('filter[date_to]', date)
  return mapSimplyBookings(await adminGet(`/admin/bookings?${params.toString()}`))
}

export async function fetchSimplyMonth(month: string) {
  const [year, mon] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const from = `${month}-01`
  const to = `${month}-${String(last).padStart(2, '0')}`
  const params = new URLSearchParams()
  params.set('on_page', '200')
  params.set('filter[date_from]', from)
  params.set('filter[date_to]', to)
  return mapSimplyBookings(await adminGet(`/admin/bookings?${params.toString()}`))
}

export async function fetchSimplyBooking(id: string) {
  return mapSimplyBooking(await adminGet(`/admin/bookings/${encodeURIComponent(id)}`))
}
