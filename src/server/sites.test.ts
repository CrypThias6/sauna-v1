import { afterEach, describe, expect, it } from 'vitest'
import { loadSites, placeProvider, providerRules } from './sites.js'
import { plainSimplyBook } from './setup.js'

const KEYS = ['SAUNA_PROVIDER_MAP', 'SAUNA_LOCATIONS'] as const
const saved = new Map<string, string | undefined>()

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  saved.clear()
})

function env(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    if (!saved.has(key)) saved.set(key, process.env[key])
    const value = values[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('provider and site config', () => {
  it('maps the six live providers and keeps one site until locations are set', () => {
    env({})
    expect(placeProvider('Camp only 8 person sauna')).toEqual({ room: 'Small', location: 'camp' })
    expect(placeProvider('Camp only 12 Person Sauna')).toEqual({ room: 'Big', location: 'camp' })
    expect(placeProvider('Lake Hāwea (12 Person Sauna)')).toEqual({ room: 'Big', location: 'hawea' })
    expect(placeProvider('Lake Hawea Private Sauna (up to 8)')).toEqual({ room: 'Small', location: 'hawea' })
    expect(placeProvider('Cardrona Shared Sauna (12 person)')).toEqual({ room: 'Big', location: 'cardrona' })
    expect(placeProvider('Cardrona Private Sauna')).toEqual({ room: 'Small', location: 'cardrona' })
    expect(loadSites()).toMatchObject({ fromEnv: false, sites: [{ id: 'site', enabled: true }] })
  })

  it('lets an owner replace the names and enable one site', () => {
    env({
      SAUNA_PROVIDER_MAP: JSON.stringify([{ provider: 'North cabin', room: 'Small', location: 'north' }]),
      SAUNA_LOCATIONS: JSON.stringify([
        { id: 'north', name: 'North', enabled: true },
        { id: 'south', name: 'South', enabled: false },
      ]),
    })
    expect(placeProvider('North cabin')).toEqual({ room: 'Small', location: 'north' })
    expect(providerRules().note).toBeNull()
    const sites = loadSites()
    expect(sites.fromEnv).toBe(true)
    expect(sites.sites.filter((site) => site.enabled).map((site) => site.id)).toEqual(['north'])
  })

  it('says when the SimplyBook user cannot read bookings', () => {
    expect(plainSimplyBook('SimplyBook refused the bookings request (200). Access denied', true, true)).toBe(
      'This SimplyBook user needs Admin or Senior Employee.',
    )
    expect(plainSimplyBook(null, false, false)).toBe('SimplyBook company, login, and user key are not all set.')
  })
})
