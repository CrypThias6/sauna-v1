import { afterEach, describe, expect, it } from 'vitest'
import { clearOutdoorHold, outdoorHold, setOutdoorHold, shownOutdoor } from './light-panel'

afterEach(() => {
  clearOutdoorHold()
})

describe('shownOutdoor', () => {
  it('follows the schedule until someone holds the switch', () => {
    expect(shownOutdoor(new Date('2026-11-16T18:00:00'), '20:30', '23:30', null)).toBe('off')
    expect(shownOutdoor(new Date('2026-11-16T21:00:00'), '20:30', '23:30', null)).toBe('on')
    expect(shownOutdoor(new Date('2026-11-16T21:00:00'), '20:30', '23:30', { value: 'off', slot: 'on' })).toBe('off')
  })

  it('drops the hold after the schedule changes', () => {
    expect(shownOutdoor(new Date('2026-11-16T23:40:00'), '20:30', '23:30', { value: 'off', slot: 'on' })).toBe('off')
  })

  it('stores the hold the Outdoor switch uses', () => {
    const now = new Date('2026-11-16T21:00:00')
    setOutdoorHold('on', now, '20:30', '23:30')
    expect(outdoorHold()).toEqual({ value: 'on', slot: 'on' })
    expect(shownOutdoor(now, '20:30', '23:30')).toBe('on')
  })
})
