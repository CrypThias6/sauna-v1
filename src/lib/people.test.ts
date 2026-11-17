import { describe, expect, it } from 'vitest'
import { peopleInRoom } from './people'

const NOW = Date.parse('2026-11-16T18:30:00+13:00')

describe('peopleInRoom', () => {
  it('is 0 when nothing is booked now', () => {
    expect(peopleInRoom([], NOW, 'Big')).toBe(0)
    expect(
      peopleInRoom(
        [{ start: '2026-11-16T19:00:00+13:00', end: '2026-11-16T20:00:00+13:00', people: 4, room: 'Big', status: 'confirmed' }],
        NOW,
        'Big',
      ),
    ).toBe(0)
  })

  it('uses the current booking party size and skips cancelled and other rooms', () => {
    expect(
      peopleInRoom(
        [
          { start: '2026-11-16T18:00:00+13:00', end: '2026-11-16T19:30:00+13:00', people: 6, room: 'Big', status: 'confirmed' },
          { start: '2026-11-16T18:00:00+13:00', end: '2026-11-16T19:00:00+13:00', people: 2, room: 'Small', status: 'confirmed' },
          { start: '2026-11-16T18:00:00+13:00', end: '2026-11-16T19:00:00+13:00', people: 9, room: 'Big', status: 'cancelled' },
        ],
        NOW,
        'Big',
      ),
    ).toBe(6)
  })

  it('is unknown when the current booking has no count', () => {
    expect(
      peopleInRoom(
        [{ start: '2026-11-16T18:00:00+13:00', end: '2026-11-16T19:30:00+13:00', people: null, room: 'Big', status: 'confirmed' }],
        NOW,
        'Big',
      ),
    ).toBeNull()
  })
})
