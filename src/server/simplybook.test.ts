import { describe, expect, it } from 'vitest'
import { mapSimplyBooking, mapSimplyBookings, simplyBookProblem } from './simplybook.js'

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
