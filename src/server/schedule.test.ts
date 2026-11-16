import { describe, expect, it } from 'vitest'
import { MockBookings } from './bookings.js'
import { dueEvents, runTick, type ScheduleEvent, type ScheduleSettings, type SentLog } from './schedule.js'

const settings: ScheduleSettings = {
  outdoorOn: '20:30',
  outdoorOff: '23:30',
  flashIntervalMin: 15,
}

const zone = 'Pacific/Auckland'

function memoryLog(): SentLog & { reads: number; writes: number; keys: string[] } {
  return {
    reads: 0,
    writes: 0,
    keys: [] as string[],
    async read() {
      this.reads += 1
      return this.keys.slice()
    },
    async write(next: readonly string[]) {
      this.writes += 1
      this.keys.splice(0, this.keys.length, ...next)
    },
  }
}

describe('16 Nov mock booking', () => {
  it('lists the evening booking in Auckland daylight time', async () => {
    const bookings = await new MockBookings().listDay('2026-11-16')
    expect(bookings).toEqual([
      {
        id: '2026-11-16-0',
        room: 'Big',
        start: '2026-11-16T18:00:00+13:00',
        end: '2026-11-16T19:30:00+13:00',
        people: 6,
        status: 'confirmed',
        name: 'Evening',
      },
    ])
  })

  it('fires each light mark once, including a second tick in the same minute', async () => {
    const bookings = await new MockBookings().listDay('2026-11-16')
    const id = bookings[0].id
    const expected: { at: string; action: ScheduleEvent['action']; key: string }[] = [
      { at: '2026-11-16T18:00:00+13:00', action: 'Glow on', key: `2026-11-16-${id}:glow:on` },
      { at: '2026-11-16T18:15:00+13:00', action: 'Gentle flash', key: `2026-11-16-${id}:flash:15` },
      { at: '2026-11-16T18:30:00+13:00', action: 'Gentle flash', key: `2026-11-16-${id}:flash:30` },
      { at: '2026-11-16T18:45:00+13:00', action: 'Gentle flash', key: `2026-11-16-${id}:flash:45` },
      { at: '2026-11-16T19:00:00+13:00', action: 'Gentle flash', key: `2026-11-16-${id}:flash:60` },
      { at: '2026-11-16T19:15:00+13:00', action: 'Gentle flash', key: `2026-11-16-${id}:flash:75` },
      { at: '2026-11-16T19:30:00+13:00', action: 'Glow off', key: `2026-11-16-${id}:glow:off` },
      { at: '2026-11-16T20:30:00+13:00', action: 'Outdoor on', key: '2026-11-16:outdoor:on' },
      { at: '2026-11-16T23:30:00+13:00', action: 'Outdoor off', key: '2026-11-16:outdoor:off' },
    ]

    const wide = dueEvents({
      now: new Date('2026-11-16T23:30:00+13:00'),
      bookings,
      settings,
      timeZone: zone,
      windowMs: 8 * 60 * 60 * 1000,
    })
    expect(wide.map((event) => ({ at: event.at, action: event.action, key: event.key }))).toEqual(expected)

    const log = memoryLog()
    const fired: string[] = []
    for (const mark of expected) {
      const now = new Date(mark.at)
      const once = dueEvents({ now, bookings, settings, timeZone: zone })
      expect(once.map((event) => event.key)).toEqual([mark.key])
      const first = await runTick({
        now,
        bookings,
        settings,
        timeZone: zone,
        sent: log,
        fire: async (event) => {
          fired.push(event.key)
        },
      })
      const second = await runTick({
        now,
        bookings,
        settings,
        timeZone: zone,
        sent: log,
        fire: async (event) => {
          fired.push(`again:${event.key}`)
        },
      })
      expect(first.fired.map((event) => event.key)).toEqual([mark.key])
      expect(second.fired).toEqual([])
      expect(second.readLog).toBe(true)
      expect(second.wroteLog).toBe(false)
    }
    expect(fired).toEqual(expected.map((mark) => mark.key))
  })
})

describe('catch-up', () => {
  it('fires a mark from the last 5 minutes and skips anything older', async () => {
    const bookings = await new MockBookings().listDay('2026-11-16')
    const glow = `2026-11-16-${bookings[0].id}:glow:on`
    const flash = `2026-11-16-${bookings[0].id}:flash:15`

    expect(dueEvents({ now: new Date('2026-11-16T18:04:00+13:00'), bookings, settings, timeZone: zone }).map((event) => event.key)).toEqual([glow])
    expect(dueEvents({ now: new Date('2026-11-16T18:06:00+13:00'), bookings, settings, timeZone: zone }).map((event) => event.key)).toEqual([])
    expect(dueEvents({ now: new Date('2026-11-16T18:19:00+13:00'), bookings, settings, timeZone: zone }).map((event) => event.key)).toEqual([flash])

    const log = memoryLog()
    const fired: string[] = []
    const now = new Date('2026-11-16T18:04:00+13:00')
    await runTick({
      now,
      bookings,
      settings,
      timeZone: zone,
      sent: log,
      fire: async (event) => {
        fired.push(event.key)
      },
    })
    await runTick({
      now,
      bookings,
      settings,
      timeZone: zone,
      sent: log,
      fire: async (event) => {
        fired.push(event.key)
      },
    })
    expect(fired).toEqual([glow])
    expect(log.reads).toBe(2)
    expect(log.writes).toBe(1)
  })

  it('does not read the sent log when nothing is due', async () => {
    const bookings = await new MockBookings().listDay('2026-11-16')
    const log = memoryLog()
    const result = await runTick({
      now: new Date('2026-11-16T17:00:00+13:00'),
      bookings,
      settings,
      timeZone: zone,
      sent: log,
      fire: async () => {
        throw new Error('nothing is due')
      },
    })
    expect(result).toEqual({ fired: [], readLog: false, wroteLog: false })
    expect(log.reads).toBe(0)
  })
})

describe('schedule inputs', () => {
  it('ignores a cancelled booking', async () => {
    const bookings = await new MockBookings().listDay('2026-11-16')
    const cancelled = { ...bookings[0], id: 'cancelled-1', status: 'cancelled' as const }
    const due = dueEvents({
      now: new Date('2026-11-16T18:00:00+13:00'),
      bookings: [cancelled],
      settings,
      timeZone: zone,
    })
    expect(due).toEqual([])
  })

  it('uses the flash interval from settings', async () => {
    const bookings = await new MockBookings().listDay('2026-11-16')
    const due = dueEvents({
      now: new Date('2026-11-16T19:30:00+13:00'),
      bookings,
      settings: { ...settings, flashIntervalMin: 30 },
      timeZone: zone,
      windowMs: 2 * 60 * 60 * 1000,
    })
    expect(due.filter((event) => event.action === 'Gentle flash').map((event) => event.key)).toEqual([
      `2026-11-16-${bookings[0].id}:flash:30`,
      `2026-11-16-${bookings[0].id}:flash:60`,
    ])
  })

  it('uses standard time in June', () => {
    const due = dueEvents({
      now: new Date('2026-06-16T20:30:00+12:00'),
      bookings: [],
      settings,
      timeZone: zone,
    })
    expect(due).toEqual([
      { key: '2026-06-16:outdoor:on', at: '2026-06-16T20:30:00+12:00', action: 'Outdoor on' },
    ])
  })
})
