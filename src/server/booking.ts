export type Booking = {
  id: string
  room: 'Small' | 'Big'
  /** ISO-8601 with the Auckland offset, for example 2026-11-16T18:00:00+13:00. */
  start: string
  end: string
  people: number | null
  status: 'confirmed' | 'cancelled'
  name?: string
  /** Set when the provider name matches a site. Absent bookings stay visible on every site. */
  location?: string
}

export interface BookingsSource {
  listDay(date: string): Promise<Booking[]>
}
