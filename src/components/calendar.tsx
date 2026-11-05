import { useMemo, useState, useSyncExternalStore } from 'react'
import { spanLabel, visitsOn, type Visit } from '../data/bookings'
import { bookingSource, bookingVersion, subscribeBookings } from '../data/simplybook'
import { peopleWord } from '../lib/format'
import { useSauna } from '../state/store'
import type { Sauna } from '../types'

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

type Row = {
  id: string
  when: string
  name: string
  meta: string
  people: number
  state: 'now' | 'booked' | 'pending' | 'cancelled'
}

function liveDetail(sauna: Sauna) {
  if (!sauna.session.active) return 'Not in a booking'
  if (sauna.session.endsInMin <= 0) return 'Ending'
  return `${Math.ceil(sauna.session.endsInMin)} min left`
}

function rowState(visit: Visit): Row['state'] {
  if (visit.status === 'cancelled' || visit.status === 'no_show') return 'cancelled'
  if (visit.status === 'pending') return 'pending'
  return 'booked'
}

function rowMeta(visit: Visit) {
  const fromBook = visit.status == null && !visit.service && !visit.provider
  if (fromBook) {
    return `${visit.room} · ${visit.people} ${peopleWord(visit.people)} · ${visit.minutes} min`
  }
  const status = visit.status && visit.status !== 'confirmed' ? visit.status.replaceAll('_', ' ') : ''
  const provider =
    visit.provider && visit.provider.toLowerCase() !== visit.room.toLowerCase() ? visit.provider : ''
  return [
    visit.service,
    provider,
    visit.room,
    visit.people > 0 ? `${visit.people} ${peopleWord(visit.people)}` : '',
    visit.minutes > 0 ? `${visit.minutes} min` : '',
    status,
    visit.notes,
  ]
    .filter(Boolean)
    .join(' · ')
}

function rowsFor(visits: Visit[], isToday: boolean, sauna: Sauna, keepBooked: boolean): Row[] {
  const booked = visits.map((visit) => ({
    id: visit.id,
    when: spanLabel(visit.time, visit.minutes),
    name: visit.name,
    meta: rowMeta(visit),
    people: visit.people,
    state: rowState(visit),
  }))
  if (!isToday) return booked
  // On the preview book, the first visit stands in for whoever is in the room.
  // Real bookings stay listed, and the live session is added above them.
  const rest = keepBooked ? booked : booked.slice(1)
  return [
    {
      id: 'now',
      when: 'Now',
      name: sauna.session.mode,
      meta: `${sauna.name} · ${sauna.occupants.length} ${peopleWord(sauna.occupants.length)} · ${liveDetail(sauna)}`,
      people: sauna.occupants.length,
      state: 'now',
    },
    ...rest,
  ]
}

export function Calendar() {
  const { now, saunas, index } = useSauna()
  const sauna = saunas[index]
  const today = new Date(now)
  const year = today.getFullYear()
  const month = today.getMonth()
  const todayDate = today.getDate()
  const [selected, setSelected] = useState<number | null>(null)
  const book = useSyncExternalStore(subscribeBookings, bookingVersion, bookingVersion)
  const keepBooked = bookingSource() === 'simplybook'

  const monthName = today.toLocaleDateString('en-GB', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = new Date(year, month, 1).getDay()

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const visits = visitsOn(year, month, day)
      const isToday = day === todayDate
      const people = isToday
        ? sauna.occupants.length
        : visits.reduce((sum, visit) => sum + visit.people, 0)
      return { day, visits, isToday, people }
    })
  }, [book, daysInMonth, month, sauna.occupants.length, todayDate, year])

  const current = selected != null ? days[selected - 1] : undefined
  const listed = current ? rowsFor(current.visits, current.isToday, sauna, keepBooked) : []
  const sessions = listed.filter((row) => row.state !== 'now' && row.state !== 'cancelled')
  const total = sessions.reduce((sum, row) => sum + row.people, 0)
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
            const count =
              day.people === 0 ? 'nobody coming' : `${day.people} ${peopleWord(day.people)}`
            return (
              <button
                key={day.day}
                type="button"
                className="cal-day"
                data-today={day.isToday}
                data-empty={day.people === 0}
                aria-pressed={day.day === selected}
                aria-label={`${label}, ${count}${day.isToday ? ', today' : ''}`}
                onClick={() => setSelected(day.day)}
              >
                <span className="cal-num">{day.day}</span>
                {day.people > 0 && <span className="cal-count">{day.people}</span>}
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
          {current.isToday
            ? `${sauna.occupants.length} in the room`
            : sessions.length === 0
              ? 'Nobody coming'
              : `${total} ${peopleWord(total)} · ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`}
        </p>
        {listed.length === 0 ? (
          <p className="cal-none">Nothing booked this day.</p>
        ) : (
          <ul className="cal-rows">
            {listed.map((row) => (
              <li key={row.id} data-state={row.state}>
                <span className="cal-when">{row.when}</span>
                <span>
                  <strong>{row.name}</strong>
                  <small>{row.meta}</small>
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
