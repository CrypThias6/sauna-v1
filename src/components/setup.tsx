import { chooseSite, useSetup } from '../lib/sites'

function mark(ok: boolean | null) {
  if (ok === true) return 'Ready'
  if (ok === false) return 'Not yet'
  return 'Not checked'
}

function when(iso: string | null) {
  if (!iso) return 'No reading yet'
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return 'No reading yet'
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at))
}

export function Setup() {
  const { report, error, enabled } = useSetup()
  return (
    <section className="block" id="setup" aria-label="Setup">
      <div className="block-head">
        <h2>Setup</h2>
        <p>Install day</p>
      </div>
      {error ? <p className="cal-fresh">{error}</p> : null}
      {!report && !error ? <p className="cal-fresh">Sign in to see what is connected.</p> : null}
      {report ? (
        <ul className="setup-list">
          <li data-ok={report.simplybook.creds}>
            <span>SimplyBook login details</span>
            <span className="setup-mark">{mark(report.simplybook.creds)}</span>
          </li>
          <li data-ok={report.simplybook.authOk}>
            <span>SimplyBook sign-in</span>
            <span className="setup-mark">{mark(report.simplybook.authOk)}</span>
          </li>
          <li data-ok={report.simplybook.permissionOk}>
            <span>Bookings permission</span>
            <span className="setup-mark">{mark(report.simplybook.permissionOk)}</span>
          </li>
          {report.simplybook.message ? <li data-ok={false}><span>{report.simplybook.message}</span></li> : null}
          {report.piqo.map((link) => (
            <li key={link.name} data-ok={link.present}>
              <span>{link.name}</span>
              <span className="setup-mark">{link.present ? 'Ready' : 'Not yet'}</span>
            </li>
          ))}
          <li data-ok={report.sensor.online}>
            <span>Sensor {report.sensor.online ? 'online' : 'offline'}</span>
            <span className="setup-mark">{when(report.sensor.lastReading)}</span>
          </li>
          <li data-ok={report.webhookSecret}>
            <span>Webhook secret</span>
            <span className="setup-mark">{mark(report.webhookSecret)}</span>
          </li>
          <li data-ok={report.cronSecret}>
            <span>Cron secret</span>
            <span className="setup-mark">{mark(report.cronSecret)}</span>
          </li>
          <li data-ok={enabled.length > 0}>
            <span>Locations</span>
            <span className="setup-mark">{enabled.map((site) => site.name).join(', ') || 'None enabled'}</span>
          </li>
          {report.notes.map((note) => (
            <li key={note} data-ok={false}><span>{note}</span></li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function SiteSelect() {
  const { enabled, site } = useSetup()
  if (enabled.length === 0) return null
  return (
    <label className="site-pick">
      <span>Site</span>
      <select aria-label="Site" value={site.id} onChange={(event) => chooseSite(event.target.value)}>
        {enabled.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </label>
  )
}
