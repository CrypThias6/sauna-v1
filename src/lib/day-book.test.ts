import { describe, expect, it } from 'vitest'
import { mergeBook, type DayBook } from './day-book'

const booking = {
  id: '1',
  room: 'Big',
  start: '2026-11-18T18:00:00+13:00',
  end: '2026-11-18T19:00:00+13:00',
  people: 2,
  status: 'confirmed',
}

function book(patch: Partial<DayBook> = {}): DayBook {
  return { connected: true, bookings: [booking], error: null, known: true, updatedAt: 1, ...patch }
}

describe('booking refresh', () => {
  it('keeps the last good list when the next pull fails and stamps a clean pull', () => {
    const previous = book()
    const failed = mergeBook(previous, book({ bookings: [], error: 'SimplyBook refused the login (401).' }), 50)
    expect(failed.bookings).toEqual(previous.bookings)
    expect(failed.updatedAt).toBe(1)
    expect(failed.error).toBe('SimplyBook refused the login (401).')

    const fresh = mergeBook(failed, book({ bookings: [{ ...booking, id: '2' }], error: null }), 80)
    expect(fresh.bookings.map((item) => item.id)).toEqual(['2'])
    expect(fresh.updatedAt).toBe(80)
    expect(fresh.error).toBeNull()
  })

  it('uses a stale server list only when the page has nothing yet', () => {
    const empty = book({ bookings: [], updatedAt: null, known: false, connected: false })
    const stale = mergeBook(empty, book({ error: 'SimplyBook bookings timed out.' }), 10)
    expect(stale.bookings).toHaveLength(1)
    expect(stale.error).toBe('SimplyBook bookings timed out.')
  })
})
