export type Booking = {
  id: string
  room: 'Small' | 'Big'
  /** ISO-8601 with the Auckland offset, for example 2026-11-16T18:00:00+13:00. */
  start: string
  end: string
  people: number | null
  status: 'confirmed' | 'cancelled'
  name?: string
}

export interface BookingsSource {
  listDay(date: string): Promise<Booking[]>
}
