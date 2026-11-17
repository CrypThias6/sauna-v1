export type Party = {
  start: string
  end: string
  status?: string
  people: number | null
  room?: string
}

/** Party size for the booking happening now. 0 if the room is empty. null if a booking has no count. */
export function peopleInRoom(bookings: Party[], now: number, room?: string): number | null {
  const current = bookings.filter((booking) => {
    if (booking.status === 'cancelled' || booking.status === 'canceled') return false
    const start = Date.parse(booking.start)
    const end = Date.parse(booking.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now >= end) return false
    if (room && booking.room && booking.room !== room) return false
    return true
  })
  if (current.length === 0) return 0
  if (current.some((booking) => booking.people == null || !Number.isFinite(booking.people))) return null
  return current.reduce((sum, booking) => sum + (booking.people ?? 0), 0)
}
