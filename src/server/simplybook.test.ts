import { afterEach, describe, expect, it } from 'vitest'
import {
  bookingListQuery,
  bookingRecordKeys,
  bookingRows,
  bookingSpan,
  bookingsMode,
  bookingsSourceFlag,
  mapSimplyBooking,
  mapSimplyBookings,
  nextBookingPage,
  simplyBookProblem,
  simplyBookReady,
  tokenExpiresAt,
  tokenUsable,
} from './simplybook.js'

describe('SimplyBook mapping', () => {
  it('keeps the client first name, party size, service and Auckland times, and drops cancelled', () => {
    const bookings = mapSimplyBookings({
      data: [
        {
          id: 44,
          status: 'confirmed',
          start_datetime: '2026-11-16 18:00:00',
          end_datetime: '2026-11-16 19:30:00',
          count: 6,
          service: { name: 'Big sauna' },
          client: { name: 'Aroha Jones' },
        },
        {
          id: 45,
          status: 'canceled',
          start_datetime: '2026-11-16 12:00:00',
          end_datetime: '2026-11-16 13:00:00',
          count: 2,
          client_name: 'Cancelled Guest',
        },
      ],
    })
    expect(bookings).toEqual([
      {
        id: '44',
        room: 'Big',
        start: '2026-11-16T18:00:00+13:00',
        end: '2026-11-16T19:30:00+13:00',
        people: 6,
        status: 'confirmed',
        name: 'Aroha',
      },
    ])
  })

  it('leaves the party size unknown when SimplyBook did not send a count', () => {
    const booking = mapSimplyBooking({
      id: '9',
      status: 'confirmed',
      start_datetime: '2026-11-18 09:00:00',
      end_datetime: '2026-11-18 10:00:00',
      service_name: 'Small sauna',
      client_name: 'Tim',
    })
    expect(booking?.people).toBeNull()
    expect(booking?.room).toBe('Small')
    expect(booking?.name).toBe('Tim')
  })
})

describe('SimplyBook errors', () => {
  it('keeps a short refusal and drops anything that looks like a credential', () => {
    expect(simplyBookProblem('auth', 401, { message: 'Invalid login or password' })).toBe('SimplyBook refused the login (401). Invalid login or password')
    expect(simplyBookProblem('auth', 0, {})).toBe('SimplyBook login did not return a token.')
    expect(simplyBookProblem('bookings', 403, { error: { message: 'Forbidden' } })).toBe('SimplyBook refused the bookings request (403). Forbidden')
    expect(simplyBookProblem('auth', 401, { message: 'password: hunter2-and-a-long-token' })).toBe('SimplyBook refused the login (401).')
    expect(simplyBookProblem('bookings', 500, { message: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' })).toBe('SimplyBook bookings failed (500).')
  })
})

const SOURCE_KEYS = [
  'BOOKINGS_SOURCE',
  'SIMPLYBOOK_COMPANY',
  'SIMPLYBOOK_USER_LOGIN',
  'SIMPLYBOOK_USER_PASSWORD',
  'SIMPLYBOOK_USER_KEY',
  'SIMPLYBOOK_API_KEY',
] as const

const saved = new Map<string, string | undefined>()

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  saved.clear()
})

function env(values: Partial<Record<(typeof SOURCE_KEYS)[number], string | undefined>>) {
  for (const key of SOURCE_KEYS) {
    if (!saved.has(key)) saved.set(key, process.env[key])
    const value = values[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('SimplyBook source', () => {
  it('treats a trimmed, quoted, or mixed-case flag as SimplyBook', () => {
    env({ BOOKINGS_SOURCE: ' SimplyBook ' })
    expect(bookingsSourceFlag()).toBe('simplybook')
    expect(bookingsMode()).toBe('simplybook')
    env({ BOOKINGS_SOURCE: '"simplybook"' })
    expect(bookingsMode()).toBe('simplybook')
    expect(simplyBookReady()).toBe(false)
  })

  it('uses SimplyBook when the company and a key are set, even without the flag', () => {
    env({ BOOKINGS_SOURCE: 'mock', SIMPLYBOOK_COMPANY: ' Secret ', SIMPLYBOOK_API_KEY: ' key ' })
    expect(bookingsMode()).toBe('simplybook')
    expect(simplyBookReady()).toBe(true)
  })

  it('stays disconnected when the flag is not simplybook and no key is set', () => {
    env({ BOOKINGS_SOURCE: 'mock' })
    expect(bookingsMode()).toBe('none')
    expect(simplyBookReady()).toBe(false)
  })
})

/** Shape returned by GET /admin/bookings: data + metadata, datetimes as YYYY-MM-DD HH:MM:SS. */
const adminPage = {
  data: [
    {
      id: 501,
      code: 'ab12cd',
      status: 'confirmed',
      is_confirmed: true,
      start_datetime: '2026-11-18 18:00:00',
      end_datetime: '2026-11-18 19:30:00',
      duration: 90,
      service: { id: 3, name: 'Small sauna' },
      provider: { id: 1, name: 'Cardrona', qty: 6 },
      client: { id: 9, name: 'Aroha Jones', email: 'secret@example.com', phone: '021000000' },
    },
    {
      id: 502,
      status: 'confirmed_pending',
      start_date: '2026-11-19',
      start_time: '09:00:00',
      end_date: '2026-11-19',
      end_time: '10:00:00',
      service_name: 'Big sauna',
      client_name: 'Tim Ngata',
    },
    {
      id: 503,
      status: 'pending',
      from: '2026-11-20 11:00:00',
      to: '2026-11-20 12:00:00',
      event: { name: 'Small sauna' },
    },
    {
      id: 504,
      status: 'canceled',
      start_datetime: '2026-11-18 08:00:00',
      end_datetime: '2026-11-18 09:00:00',
      client: { name: 'Gone Guest', email: 'gone@example.com' },
    },
    {
      id: 505,
      status: 'confirmed',
      start_datetime: '2026-11-21 16:00:00',
      duration: 45,
      service: { name: 'Big sauna' },
      client: { name: 'Sam' },
    },
  ],
  metadata: { items_count: 5, pages_count: 1, page: 1, on_page: 100 },
}

describe('SimplyBook admin list', () => {
  it('keeps confirmed, pending and duration-only rows from a realistic page and drops canceled', () => {
    const bookings = mapSimplyBookings(adminPage)
    expect(bookings.map((booking) => booking.id)).toEqual(['501', '502', '503', '505'])
    expect(bookings[0]).toMatchObject({
      room: 'Small',
      start: '2026-11-18T18:00:00+13:00',
      end: '2026-11-18T19:30:00+13:00',
      name: 'Aroha',
      status: 'confirmed',
    })
    expect(bookings[1]).toMatchObject({
      room: 'Big',
      start: '2026-11-19T09:00:00+13:00',
      end: '2026-11-19T10:00:00+13:00',
      status: 'confirmed',
      name: 'Tim',
    })
    expect(bookings[2].room).toBe('Small')
    expect(bookings[3]).toMatchObject({ start: '2026-11-21T16:00:00+13:00', end: '2026-11-21T16:45:00+13:00' })
    expect(JSON.stringify(bookings)).not.toContain('secret@example.com')
  })

  it('reads an id-keyed data object and reports keys without values', () => {
    const keyed = { data: { '501': adminPage.data[0] } }
    expect(bookingRows(keyed)).toHaveLength(1)
    expect(mapSimplyBookings(keyed)).toHaveLength(1)
    const keys = bookingRecordKeys(adminPage.data[0])
    expect(keys).toContain('start_datetime')
    expect(keys).toContain('client')
    expect(keys.join(' ')).not.toContain('secret@example.com')
    expect(keys.join(' ')).not.toContain('Aroha')
  })

  it('asks for 100 per page with literal filters and follows pages_count', () => {
    const query = bookingListQuery(1, { from: '2026-11-01', to: '2027-01-17' })
    expect(query).toContain('on_page=100')
    expect(query).toContain('filter[upcoming_only]=0')
    expect(query).toContain('filter[date_from]=2026-11-01')
    expect(query).toContain('filter[date_to]=2027-01-17')
    expect(query).not.toContain('%5B')
    expect(nextBookingPage(1, 10, { pages_count: 2, on_page: 10, items_count: 16 })).toBe(2)
    expect(nextBookingPage(2, 6, { pages_count: 2 })).toBeNull()
    expect(nextBookingPage(1, 100, {})).toBe(2)
    expect(nextBookingPage(1, 4, {})).toBeNull()
  })
})

describe('SimplyBook token and range', () => {
  it('reuses a token until just before expiry and asks for a modest date range', () => {
    const now = Date.parse('2026-11-18T02:00:00Z')
    expect(tokenExpiresAt({ expires_in: 120 }, now)).toBe(now + 120_000)
    expect(tokenUsable(now + 30_000, now)).toBe(false)
    expect(tokenUsable(now + 120_000, now)).toBe(true)
    expect(bookingSpan('2026-11-18')).toEqual({ from: '2026-11-01', to: '2027-01-17' })
    expect(bookingSpan('2026-11-02').from).toBe('2026-10-26')
  })
})
