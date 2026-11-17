/**
 * Booking shapes for the calendar. The sample month is not here.
 * A day with no source returns nothing.
 */
export type Visit = {
  id: string
  time: string
  minutes: number
  room: 'Small' | 'Big' | ''
  name: string
  people: number
  status?: string
  service?: string
  provider?: string
  email?: string
  phone?: string
  notes?: string
}

export function visitsOn(_year: number, _monthIndex: number, _day: number): Visit[] {
  return []
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
