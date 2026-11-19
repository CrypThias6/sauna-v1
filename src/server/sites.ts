/**
 * Locations and provider names come from env, so a new owner does not need a code change.
 * Unset env keeps one site and the built-in Secret Sauna names.
 */

export type Site = { id: string; name: string; enabled: boolean }
export type RoomName = 'Small' | 'Big'
export type ProviderRule = { provider: string; room: RoomName; location: string }
export type Placement = { room: RoomName; location: string | null }

const BUILTIN: ProviderRule[] = [
  { provider: 'Camp only 8 person sauna', room: 'Small', location: 'camp' },
  { provider: 'Camp only 12 Person Sauna', room: 'Big', location: 'camp' },
  { provider: 'Lake Hāwea (12 Person Sauna)', room: 'Big', location: 'hawea' },
  { provider: 'Lake Hāwea Private Sauna (up to 8)', room: 'Small', location: 'hawea' },
  { provider: 'Cardrona Shared Sauna (12 person)', room: 'Big', location: 'cardrona' },
  { provider: 'Cardrona Private Sauna', room: 'Small', location: 'cardrona' },
]

function clean(value: string | undefined) {
  return (value ?? '').replace(/^\uFEFF/, '').trim().replace(/^['"]+|['"]+$/g, '').trim()
}

export function foldName(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function roomName(value: unknown): RoomName | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'small') return 'Small'
  if (raw === 'big') return 'Big'
  return null
}

export function providerRules() {
  const raw = clean(process.env.SAUNA_PROVIDER_MAP)
  if (!raw) return { rules: BUILTIN, note: null as string | null }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return { rules: BUILTIN, note: 'SAUNA_PROVIDER_MAP is not a list. The built-in names are in use.' }
    const rules: ProviderRule[] = []
    for (const item of parsed) {
      if (!isRecord(item)) continue
      const provider = typeof item.provider === 'string' ? item.provider.trim() : ''
      const room = roomName(item.room)
      const location = typeof item.location === 'string' ? item.location.trim() : ''
      if (!provider || !room || !location) continue
      rules.push({ provider, room, location })
    }
    if (!rules.length) return { rules: BUILTIN, note: 'SAUNA_PROVIDER_MAP has no usable rows. The built-in names are in use.' }
    return { rules, note: null }
  } catch {
    return { rules: BUILTIN, note: 'SAUNA_PROVIDER_MAP is not valid JSON. The built-in names are in use.' }
  }
}

export function loadSites() {
  const raw = clean(process.env.SAUNA_LOCATIONS)
  if (!raw) return { sites: [{ id: 'site', name: 'This site', enabled: true }] as Site[], fromEnv: false, note: null as string | null }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return { sites: [{ id: 'site', name: 'This site', enabled: true }], fromEnv: false, note: 'SAUNA_LOCATIONS is not a list. One site is shown.' }
    const sites: Site[] = []
    for (const item of parsed) {
      if (!isRecord(item)) continue
      const id = typeof item.id === 'string' ? item.id.trim() : ''
      const name = typeof item.name === 'string' ? item.name.trim() : ''
      if (!id || !name || typeof item.enabled !== 'boolean') continue
      sites.push({ id, name, enabled: item.enabled })
    }
    if (!sites.length) return { sites: [{ id: 'site', name: 'This site', enabled: true }], fromEnv: false, note: 'SAUNA_LOCATIONS has no usable rows. One site is shown.' }
    return { sites, fromEnv: true, note: sites.some((site) => site.enabled) ? null : 'No location is enabled.' }
  } catch {
    return { sites: [{ id: 'site', name: 'This site', enabled: true }], fromEnv: false, note: 'SAUNA_LOCATIONS is not valid JSON. One site is shown.' }
  }
}

function guessLocation(folded: string) {
  if (folded.includes('hawea')) return 'hawea'
  if (folded.includes('cardrona')) return 'cardrona'
  if (folded.includes('camp')) return 'camp'
  return null
}

/** Provider or unit name first. A JSON map replaces the built-in names when it is set. */
export function placeProvider(name: string): Placement {
  const folded = foldName(name)
  const rules = [...providerRules().rules].sort((a, b) => b.provider.length - a.provider.length)
  for (const rule of rules) {
    const key = foldName(rule.provider)
    if (key && (folded === key || folded.includes(key))) return { room: rule.room, location: rule.location }
  }
  const location = guessLocation(folded)
  if (/\b12\b/.test(folded) || /\bshared\b/.test(folded)) return { room: 'Big', location }
  if (/\b8\b/.test(folded) || /\bprivate\b/.test(folded) || /\bsmall\b/.test(folded)) return { room: 'Small', location }
  return { room: 'Big', location }
}
