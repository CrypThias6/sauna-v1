import { useEffect, useRef } from 'react'
import { formatClock, formatMin, peopleWord } from '../lib/format'
import { useSauna } from '../state/store'
import type { CameraZone, Occupant, Sauna } from '../types'

const POSES = [
  { left: '28%', bottom: '14%', scale: 1 },
  { left: '46%', bottom: '12%', scale: 0.94 },
  { left: '64%', bottom: '16%', scale: 1.05 },
  { left: '38%', bottom: '10%', scale: 0.86 },
]

function countIn(sauna: Sauna, zone: string) {
  return sauna.occupants.filter((person) => person.zone === zone)
}

function placeOf(sauna: Sauna, person: Occupant) {
  return sauna.slots.find((slot) => slot.id === person.slot)?.place ?? person.zone
}

function Feed({
  sauna,
  camera,
  now,
  large = false,
}: {
  sauna: Sauna
  camera: CameraZone
  now: number
  large?: boolean
}) {
  const people = countIn(sauna, camera.id)
  return (
    <div className={large ? 'feed feed-lg' : 'feed'} data-zone={camera.id} data-kind={sauna.kind}>
      <div className="feed-top">
        <span className="rec">
          <i />
          Rec
        </span>
        <span>{camera.label}</span>
      </div>
      {people.map((person, i) => {
        const pose = POSES[i % POSES.length]
        return (
          <span
            key={person.id}
            className="silhouette"
            style={{
              left: pose.left,
              bottom: pose.bottom,
              background: person.towel,
              transform: `scale(${pose.scale})`,
            }}
          />
        )
      })}
      {people.length === 0 && <span className="clear">Clear</span>}
      <div className="feed-bottom">
        <strong>{people.length}</strong>
        <span>{peopleWord(people.length)}</span>
        <time>{formatClock(now)}</time>
      </div>
    </div>
  )
}

function CameraModal({ sauna, cameraId }: { sauna: Sauna; cameraId: string }) {
  const { now, closeCamera, openCamera } = useSauna()
  const closeRef = useRef<HTMLButtonElement>(null)
  const camera = sauna.cameras.find((item) => item.id === cameraId) ?? sauna.cameras[0]
  const people = countIn(sauna, camera.id)

  useEffect(() => {
    closeRef.current?.focus()
  }, [camera.id])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCamera()
      const ids = sauna.cameras.map((item) => item.id)
      const at = ids.indexOf(camera.id)
      if (event.key === 'ArrowRight') openCamera(ids[(at + 1) % ids.length])
      if (event.key === 'ArrowLeft') openCamera(ids[(at - 1 + ids.length) % ids.length])
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [camera.id, closeCamera, openCamera, sauna.cameras])

  return (
    <div className="modal-back" onClick={(event) => event.target === event.currentTarget && closeCamera()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${camera.label} camera`}>
        <Feed sauna={sauna} camera={camera} now={now} large />
        <div className="modal-side">
          <div className="modal-head">
            <div>
              <p className="k">{sauna.name}</p>
              <h2>{camera.label}</h2>
            </div>
            <button ref={closeRef} type="button" className="close" onClick={closeCamera}>
              Close
            </button>
          </div>
          <p className="modal-count">
            <strong>{people.length}</strong>
            <span>{peopleWord(people.length)} in this view</span>
          </p>
          <ul className="people-list">
            {people.length === 0 && <li className="empty">Nobody in this view.</li>}
            {people.map((person) => (
              <li key={person.id}>
                <span className="swatch" style={{ background: person.towel }} />
                <span>
                  <strong>{placeOf(sauna, person)}</strong>
                  <small>In this spot {formatMin(person.zoneSinceMin)}</small>
                </span>
                <em>{formatMin(person.sinceMin)}</em>
              </li>
            ))}
          </ul>
          <div className="film">
            {sauna.cameras.map((item) => {
              const count = countIn(sauna, item.id).length
              return (
                <button
                  key={item.id}
                  type="button"
                  className="film-btn"
                  data-active={item.id === camera.id}
                  onClick={() => openCamera(item.id)}
                >
                  <span>{item.label}</span>
                  <strong>{count}</strong>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Cameras() {
  const { saunas, index, now, cameraId, openCamera } = useSauna()
  const sauna = saunas[index]

  return (
    <section className="block" aria-label="Cameras">
      <div className="block-head">
        <h2>Cameras</h2>
        <p>
          {sauna.name} · {sauna.cameras.length} views
        </p>
      </div>
      <div className="cam-row">
        {sauna.cameras.map((camera) => {
          const count = countIn(sauna, camera.id).length
          return (
            <button
              key={camera.id}
              type="button"
              className="cam"
              onClick={() => openCamera(camera.id)}
              aria-label={`${camera.label} camera, ${count} ${peopleWord(count)}. Expand`}
            >
              <Feed sauna={sauna} camera={camera} now={now} />
            </button>
          )
        })}
      </div>
      {cameraId && <CameraModal sauna={sauna} cameraId={cameraId} />}
    </section>
  )
}
