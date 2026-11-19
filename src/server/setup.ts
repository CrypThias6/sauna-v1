/**
 * Install-day checklist. Booleans and safe sentences only. No secrets, tokens, or link URLs.
 */
import { bookingStatus } from './bookings.js'
import { piqoLinksPresent } from './piqo.js'
import { loadSites, providerRules } from './sites.js'
import { bookingsMode, simplyBookReady } from './simplybook.js'
import { readTelemetry } from './telemetry.js'

export type SetupReport = {
  simplybook: {
    creds: boolean
    authOk: boolean | null
    permissionOk: boolean | null
    message: string | null
  }
  piqo: { name: string; present: boolean }[]
  sensor: { online: boolean; lastReading: string | null }
  webhookSecret: boolean
  cronSecret: boolean
  locations: { id: string; name: string; enabled: boolean }[]
  filterLocations: boolean
  notes: string[]
}

function present(name: string) {
  return Boolean(process.env[name]?.trim())
}

export function plainSimplyBook(error: string | null, authOk: boolean | null, creds: boolean) {
  if (!creds) return 'SimplyBook company, login, and user key are not all set.'
  if (error && /access.?denied|not allowed|permission|forbidden/i.test(error)) return 'This SimplyBook user needs Admin or Senior Employee.'
  if (error) return error
  if (authOk === false) return 'SimplyBook did not accept the login.'
  return null
}

export async function setupReport(): Promise<SetupReport> {
  const creds = simplyBookReady()
  const status = bookingsMode() === 'simplybook' ? await bookingStatus() : null
  const message = plainSimplyBook(status?.error ?? null, status?.authOk ?? null, creds)
  const permissionOk = !creds ? false : message?.includes('Admin or Senior Employee') ? false : status?.authOk === true && !status.error ? true : status?.error ? false : null
  const sites = loadSites()
  const map = providerRules()
  const notes = [sites.note, map.note].filter((note): note is string => Boolean(note))
  let sensor = { online: false, lastReading: null as string | null }
  try {
    const live = await readTelemetry()
    sensor = { online: live.link === 'online', lastReading: live.recordedAt ?? live.heardAt }
  } catch {
    sensor = { online: false, lastReading: null }
  }
  return {
    simplybook: {
      creds,
      authOk: creds ? (status?.authOk ?? null) : false,
      permissionOk,
      message,
    },
    piqo: piqoLinksPresent(),
    sensor,
    webhookSecret: present('SIMPLYBOOK_WEBHOOK_SECRET'),
    cronSecret: present('CRON_SECRET'),
    locations: sites.sites,
    filterLocations: sites.fromEnv && sites.sites.some((site) => site.enabled),
    notes,
  }
}
