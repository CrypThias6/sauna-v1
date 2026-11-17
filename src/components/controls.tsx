import { formatTemp } from '../lib/format'
import { peopleInRoom } from '../lib/people'
import { useLiveSensor } from '../lib/sensor'
import { sensorLink } from '../lib/sensor-status'
import { useTodayBook } from '../lib/day-book'
import { useSauna } from '../state/store'

function ageLabel(recordedAt: string | null, now: number) {
  if (!recordedAt) return ''
  const at = Date.parse(recordedAt)
  if (!Number.isFinite(at)) return ''
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 120) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

export function Controls() {
  const { saunas, index, now } = useSauna()
  const sensor = useLiveSensor()
  const book = useTodayBook()
  const sauna = saunas[index]
  const link = sensor.known ? sensorLink({ now, heardAt: sensor.heardAt, reachable: sensor.reachable }) : null
  const heard = ageLabel(sensor.heardAt, now)
  const age = ageLabel(sensor.temperature?.recordedAt ?? sensor.recordedAt, now)
  const humidAge = ageLabel(sensor.humidity?.recordedAt ?? null, now)
  const badge =
    link === 'online'
      ? 'Sensor online'
      : link === 'offline'
        ? heard
          ? `Sensor offline · last heard ${heard}`
          : 'Sensor offline'
        : link === 'unreachable'
          ? "Can't reach Piqo"
          : ''
  const people = book.known && book.connected ? peopleInRoom(book.bookings, now, sauna.name) : null
  const peopleLine = !book.known
    ? 'Checking the calendar'
    : !book.connected
      ? 'Booking calendar not connected'
      : people == null
        ? 'Party size unknown'
        : people === 0
          ? 'No booking now'
          : 'Booked now'

  return (
    <section className="block" id="controls" aria-label="This room">
      <div className="block-head">
        <h2>This room</h2>
        <p>{sauna.name}</p>
      </div>
      {badge ? (
        <p className="sensor-badge" data-link={link ?? undefined}>
          {badge}
        </p>
      ) : null}
      <div className="controls">
        <div className="chip" data-stale={sensor.celsius == null || link !== 'online' ? true : undefined}>
          <span className="k">Temp</span>
          <span className="v">
            {sensor.celsius == null ? '—' : formatTemp(sensor.celsius)}
            {sensor.celsius == null ? null : <sup>°</sup>}
          </span>
          <span className="s">{sensor.celsius == null ? sensor.error || 'No temperature reading.' : `updated ${age || 'just now'}`}</span>
        </div>
        <div className="chip" data-stale={true}>
          <span className="k">CO</span>
          <span className="v">—</span>
          <span className="s">No CO sensor</span>
        </div>
        <div className="chip" data-stale={sensor.humidityPercent == null || link !== 'online' ? true : undefined}>
          <span className="k">Humidity</span>
          <span className="v">
            {sensor.humidityPercent == null ? '—' : Number.isInteger(sensor.humidityPercent) ? sensor.humidityPercent : sensor.humidityPercent.toFixed(1)}
            {sensor.humidityPercent == null ? null : <small>%</small>}
          </span>
          <span className="s">
            {sensor.humidityPercent == null ? sensor.humidityError || 'No humidity reading.' : `updated ${humidAge || 'just now'}`}
          </span>
        </div>
        <div className="chip">
          <span className="k">People</span>
          <span className="v">{people == null ? '—' : people}</span>
          <span className="s">{peopleLine}</span>
        </div>
      </div>
    </section>
  )
}
