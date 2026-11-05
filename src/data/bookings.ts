/**
 * Preview book for the month on screen. Not reservations.
 * The day the console calls "today" replaces the first visit
 * with the live session in the calendar.
 * Real SimplyBook rows, once accepted, replace this book for the grid.
 */
import { bookingSource, liveVisitsOn } from './simplybook'
export type Visit = {
  id: string
  time: string
  minutes: number
  room: 'Small' | 'Big' | ''
  name: string
  people: number
  /** Set when the visit came from SimplyBook. Absent on the preview book. */
  status?: string
  service?: string
  provider?: string
  email?: string
  phone?: string
  notes?: string
}

type Draft = [time: string, minutes: number, room: 'Small' | 'Big', name: string, people: number]

const BOOK: Record<number, Draft[]> = {
  1: [
    ['08:00', 90, 'Small', 'Dawn', 4],
    ['11:00', 120, 'Big', 'Long heat', 7],
    ['16:30', 90, 'Small', 'Afternoon', 5],
    ['19:00', 75, 'Big', 'Evening', 6],
  ],
  2: [
    ['07:00', 60, 'Small', 'Dawn', 2],
    ['18:00', 90, 'Big', 'Evening', 5],
  ],
  3: [],
  4: [
    ['08:30', 80, 'Small', 'Heat', 4],
    ['13:00', 60, 'Big', 'Midday', 3],
    ['19:30', 75, 'Big', 'Late', 6],
  ],
  5: [
    ['07:30', 60, 'Big', 'Dawn', 3],
    ['16:00', 90, 'Small', 'Afternoon', 5],
  ],
  6: [
    ['07:00', 60, 'Small', 'Dawn', 2],
    ['12:00', 75, 'Big', 'Midday', 6],
    ['17:00', 120, 'Small', 'Club', 6],
    ['20:00', 90, 'Big', 'Late', 8],
  ],
  7: [
    ['09:00', 120, 'Big', 'Morning', 8],
    ['13:00', 90, 'Small', 'Midday', 5],
    ['16:30', 90, 'Big', 'Afternoon', 7],
    ['19:30', 90, 'Small', 'Evening', 4],
  ],
  8: [
    ['08:30', 90, 'Small', 'Dawn', 3],
    ['11:30', 120, 'Big', 'Long heat', 6],
    ['18:00', 75, 'Big', 'Evening', 5],
  ],
  9: [
    ['09:30', 75, 'Small', 'Morning', 4],
    ['18:30', 90, 'Big', 'Evening', 4],
  ],
  10: [
    ['07:00', 60, 'Big', 'Dawn', 2],
    ['12:30', 60, 'Small', 'Midday', 3],
    ['17:30', 90, 'Small', 'Evening', 5],
  ],
  11: [],
  12: [
    ['15:30', 90, 'Small', 'Afternoon', 6],
    ['19:00', 75, 'Big', 'Late', 4],
  ],
  13: [
    ['07:00', 60, 'Small', 'Dawn', 3],
    ['12:00', 75, 'Big', 'Midday', 5],
    ['17:00', 120, 'Small', 'Club', 6],
    ['20:30', 90, 'Big', 'Late', 7],
  ],
  14: [
    ['09:00', 120, 'Big', 'Morning', 7],
    ['13:00', 90, 'Small', 'Midday', 4],
    ['16:00', 90, 'Big', 'Afternoon', 8],
    ['19:30', 75, 'Small', 'Evening', 5],
  ],
  15: [
    ['08:00', 90, 'Small', 'Dawn', 5],
    ['11:00', 120, 'Big', 'Long heat', 8],
    ['16:00', 90, 'Small', 'Afternoon', 4],
  ],
  16: [['18:00', 90, 'Big', 'Evening', 6]],
  17: [
    ['09:00', 75, 'Small', 'Morning', 3],
    ['12:30', 60, 'Big', 'Midday', 4],
    ['17:30', 80, 'Small', 'Evening', 2],
  ],
  18: [
    ['08:30', 80, 'Small', 'Heat', 5],
    ['19:30', 90, 'Big', 'Late', 7],
  ],
  19: [],
  20: [
    ['07:00', 60, 'Small', 'Dawn', 2],
    ['12:00', 90, 'Big', 'Midday', 7],
    ['17:00', 120, 'Small', 'Club', 6],
  ],
  21: [
    ['09:30', 120, 'Big', 'Morning', 8],
    ['16:00', 90, 'Big', 'Afternoon', 6],
    ['19:30', 75, 'Small', 'Evening', 3],
  ],
  22: [
    ['08:00', 90, 'Small', 'Dawn', 4],
    ['11:30', 120, 'Big', 'Long heat', 7],
    ['18:30', 75, 'Small', 'Evening', 6],
  ],
  23: [
    ['07:30', 45, 'Small', 'Dawn', 1],
    ['18:00', 90, 'Big', 'Evening', 4],
  ],
  24: [
    ['12:30', 75, 'Big', 'Midday', 5],
    ['17:30', 90, 'Small', 'Evening', 4],
  ],
  25: [
    ['09:00', 75, 'Small', 'Morning', 3],
    ['13:00', 60, 'Big', 'Midday', 2],
    ['19:30', 75, 'Big', 'Late', 5],
  ],
  26: [],
  27: [
    ['07:00', 60, 'Small', 'Dawn', 4],
    ['17:00', 120, 'Small', 'Club', 6],
    ['20:00', 90, 'Big', 'Late', 8],
  ],
  28: [
    ['09:00', 120, 'Big', 'Morning', 8],
    ['13:00', 90, 'Small', 'Midday', 6],
    ['16:30', 90, 'Big', 'Afternoon', 7],
    ['19:00', 75, 'Small', 'Evening', 4],
  ],
  29: [
    ['08:30', 90, 'Small', 'Dawn', 3],
    ['11:30', 120, 'Big', 'Long heat', 6],
  ],
  30: [
    ['09:30', 75, 'Small', 'Morning', 2],
    ['18:00', 90, 'Big', 'Evening', 5],
  ],
  31: [['12:30', 75, 'Big', 'Midday', 4]],
}

export function visitsOn(year: number, monthIndex: number, day: number): Visit[] {
  if (bookingSource() === 'simplybook') return liveVisitsOn(year, monthIndex, day)
  const drafts = BOOK[day] ?? []
  return drafts.map((draft, index) => {
    const [time, minutes, room, name, people] = draft
    return {
      id: `${year}-${monthIndex + 1}-${day}-${index}`,
      time,
      minutes,
      room,
      name,
      people,
    }
  })
}

export function spanLabel(time: string, minutes: number) {
  if (!time.includes(':')) return time || 'Unscheduled'
  const [hour, minute] = time.split(':').map(Number)
  const end = hour * 60 + minute + minutes
  const endHour = Math.floor(end / 60) % 24
  const endMinute = end % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${time}–${pad(endHour)}:${pad(endMinute)}`
}
