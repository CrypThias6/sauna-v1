import type { ScheduleSettings } from './schedule.js'

export type LightSettings = ScheduleSettings & {
  outdoorColor: string
  glowColor: string
}

export const defaultSettings: LightSettings = {
  outdoorOn: '20:30',
  outdoorOff: '23:30',
  outdoorColor: '#ffc58f',
  glowColor: '#ffd7a8',
  flashIntervalMin: 15,
}

function clock(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return fallback
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return fallback
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback
}

function interval(value: unknown, fallback: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(60, Math.max(5, Math.round(number)))
}

export function normalizeSettings(input: unknown, base: LightSettings = defaultSettings): LightSettings {
  const record = input && typeof input === 'object' ? (input as Partial<LightSettings>) : {}
  return {
    outdoorOn: clock(record.outdoorOn, base.outdoorOn),
    outdoorOff: clock(record.outdoorOff, base.outdoorOff),
    outdoorColor: color(record.outdoorColor, base.outdoorColor),
    glowColor: color(record.glowColor, base.glowColor),
    flashIntervalMin: interval(record.flashIntervalMin, base.flashIntervalMin),
  }
}
