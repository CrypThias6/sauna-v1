import { useMemo, useState } from 'react'
import { spanLabel } from '../data/bookings'
import { useMonthBook } from '../lib/day-book'
import { peopleWord } from '../lib/format'
import { useSauna } from '../state/store'

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function minutesBetween(start: string, end: string) {
  const span = Date.parse(end) - Date.parse(start)
  return Number.isFinite(span) ? Math.max(0, Math.round(span / 60_000)) : 0
}

function clock(iso: string) {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at))
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('hour')}:${pick('minute')}`
}

function updatedLabel(at: number) {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at))
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `Updated ${pick('hour')}:${pick('minute')}`
}

function dayOf(iso: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Auckland',
    day: 'numeric',
  }).formatToParts(new Date(iso))
  return Number(parts.find((part) => part.type === 'day')?.value ?? '')
}

export function Calendar() {
  const { now, saunas, index } = useSauna()
  const sauna = saunas[index]
  const book = useMonthBook()
  const todayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now))
  const pick = (type: string) => todayParts.find((part) => part.type === type)?.value ?? ''
  const year = Number(pick('year'))
  const month = Number(pick('month')) - 1
  const todayDate = Number(pick('day'))
  const [selected, setSelected] = useState<number | null>(null)

  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = new Date(year, month, 1).getDay()

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const visits = book.bookings.filter((booking) => dayOf(booking.start) === day && booking.status !== 'cancelled')
      const isToday = day === todayDate
      const known = visits.length > 0 && visits.every((booking) => booking.people != null)
      const people = known ? visits.reduce((sum, booking) => sum + (booking.people ?? 0), 0) : null
      return { day, visits, isToday, people }
    })
  }, [book.bookings, daysInMonth, todayDate])

  const current = selected != null ? days[selected - 1] : undefined
  const listed = (current?.visits ?? []).filter((booking) => !booking.room || booking.room === sauna.name)
  const knownTotal = listed.every((booking) => booking.people != null)
  const total = knownTotal ? listed.reduce((sum, booking) => sum + (booking.people ?? 0), 0) : null
  const weekday = current
    ? new Date(year, month, current.day).toLocaleDateString('en-GB', { weekday: 'long' })
    : ''

  return (
    <section className="calendar" data-open={current != null} aria-label="Calendar">
      <div className="cal-main">
        <header className="cal-head">
          <h2>{monthName}</h2>
          <span>{year}</span>
        </header>
        {book.known && (book.error || book.updatedAt) ? (
          <p className="cal-fresh">{book.error || updatedLabel(book.updatedAt ?? 0)}</p>
        ) : null}
        {book.known && !book.connected && !book.error ? <p className="cal-none">Booking calendar not connected</p> : null}
        {book.known && book.connected && !book.error && book.bookings.length === 0 ? <p className="cal-none">No bookings yet</p> : null}
        <div className="cal-grid" role="group" aria-label={`${monthName} ${year}`}>
          {DOW.map((label) => (
            <div key={label} className="cal-dow">
              {label}
            </div>
          ))}
          {Array.from({ length: lead }, (_, index) => (
            <div key={`blank-${index}`} className="cal-blank" />
          ))}
          {days.map((day) => {
            const label = new Date(year, month, day.day).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })
            const sessions = day.visits.length
            const count = !book.connected
              ? 'calendar not connected'
              : sessions === 0
                ? 'nobody coming'
                : day.people == null
                  ? `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`
                  : day.people === 0
                    ? 'nobody coming'
                    : `${day.people} ${peopleWord(day.people)}`
            const badge = !book.connected || sessions === 0 ? null : day.people != null && day.people > 0 ? day.people : sessions
            return (
              <button
                key={day.day}
                type="button"
                className="cal-day"
                data-today={day.isToday}
                data-empty={!book.connected || sessions === 0 || day.people === 0}
                aria-pressed={day.day === selected}
                aria-label={`${label}, ${count}${day.isToday ? ', today' : ''}`}
                onClick={() => setSelected(day.day)}
              >
                <span className="cal-num">{day.day}</span>
                {badge != null ? <span className="cal-count">{badge}</span> : null}
              </button>
            )
          })}
        </div>
      </div>
      {current && (
      <div className="cal-detail" aria-live="polite">
        <p className="cal-kicker">{current.isToday ? 'Today' : weekday}</p>
        <h3>
          {current.day}
          <span>{monthName}</span>
        </h3>
        <p className="cal-sum">
          {!book.connected
            ? 'Booking calendar not connected'
            : listed.length === 0
              ? 'No bookings yet'
              : total == null
                ? `${listed.length} ${listed.length === 1 ? 'session' : 'sessions'}`
                : `${total} ${peopleWord(total)} · ${listed.length} ${listed.length === 1 ? 'session' : 'sessions'}`}
        </p>
        {!book.connected ? (
          <p className="cal-none">Booking calendar not connected</p>
        ) : listed.length === 0 ? (
          <p className="cal-none">No bookings yet</p>
        ) : (
          <ul className="cal-rows">
            {listed.map((booking) => (
              <li key={booking.id} data-state="booked">
                <span className="cal-when">{spanLabel(clock(booking.start), minutesBetween(booking.start, booking.end))}</span>
                <span>
                  <strong>{booking.name || 'Booking'}</strong>
                  <small>{booking.room}{booking.people == null ? '' : ` · ${booking.people} ${peopleWord(booking.people)}`}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
    </section>
  )
}
