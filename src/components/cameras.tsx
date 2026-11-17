import { useEffect, useRef } from 'react'
import { formatClock } from '../lib/format'
import { useSauna } from '../state/store'
import type { CameraZone, Sauna } from '../types'

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
  return (
    <div className={large ? 'feed feed-lg' : 'feed'} data-zone={camera.id} data-kind={sauna.kind}>
      <div className="feed-top">
        <span className="rec">
          <i />
          Rec
        </span>
        <span>{camera.label}</span>
      </div>
      <span className="clear">No camera yet</span>
      <div className="feed-bottom">
        <strong>—</strong>
        <span>No count</span>
        <time>{formatClock(now)}</time>
      </div>
    </div>
  )
}

function CameraModal({ sauna, cameraId }: { sauna: Sauna; cameraId: string }) {
  const { now, closeCamera, openCamera } = useSauna()
  const closeRef = useRef<HTMLButtonElement>(null)
  const camera = sauna.cameras.find((item) => item.id === cameraId) ?? sauna.cameras[0]

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
            <strong>—</strong>
            <span>No count</span>
          </p>
          <ul className="people-list">
            <li className="empty">No camera count yet.</li>
          </ul>
          <div className="film">
            {sauna.cameras.map((item) => (
              <button
                key={item.id}
                type="button"
                className="film-btn"
                data-active={item.id === camera.id}
                onClick={() => openCamera(item.id)}
              >
                <span>{item.label}</span>
                <strong>—</strong>
              </button>
            ))}
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
        {sauna.cameras.map((camera) => (
          <button
            key={camera.id}
            type="button"
            className="cam"
            onClick={() => openCamera(camera.id)}
            aria-label={`${camera.label} camera. Expand`}
          >
            <Feed sauna={sauna} camera={camera} now={now} />
          </button>
        ))}
      </div>
      {cameraId && <CameraModal sauna={sauna} cameraId={cameraId} />}
    </section>
  )
}
