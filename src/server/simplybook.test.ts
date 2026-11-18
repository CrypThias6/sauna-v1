import { afterEach, describe, expect, it } from 'vitest'
import { bookingSpan, bookingsMode, bookingsSourceFlag, mapSimplyBooking, mapSimplyBookings, simplyBookProblem, simplyBookReady, tokenExpiresAt, tokenUsable } from './simplybook.js'

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
