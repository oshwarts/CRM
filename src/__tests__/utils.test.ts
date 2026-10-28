import { afterEach, describe, expect, it, vi } from 'vitest'
import { classNames, csvCell, daysUntil, formatDate, isOverdue, isoToLocalInput, localInputToIso, todayISO } from '../lib/utils'

afterEach(() => vi.useRealTimers())

describe('dates', () => {
  it('formats an ISO date the Israeli way, and an empty or broken one as nothing', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026')
    expect(formatDate(null)).toBe('')
    expect(formatDate('not a date')).toBe('')
  })
  it('counts days from today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T10:00:00'))
    expect(todayISO()).toBe('2026-10-18')
    expect(daysUntil('2026-10-18')).toBe(0)
    expect(daysUntil('2026-10-21')).toBe(3)
    expect(daysUntil('2026-10-15')).toBe(-3)
    expect(daysUntil(null)).toBeNull()
  })
  it('overdue means strictly before today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T10:00:00'))
    expect(isOverdue('2026-10-17')).toBe(true)
    expect(isOverdue('2026-10-18')).toBe(false)
    expect(isOverdue(null)).toBe(false)
  })
})

describe('csvCell', () => {
  it('quotes commas, quotes and new lines', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })
  it('neutralises a formula so that Excel does not run it', () => {
    expect(csvCell('=SUM(A1:A2)').startsWith("'") || csvCell('=SUM(A1:A2)').startsWith('"\'')).toBe(true)
  })
})

describe('classNames', () => {
  it('joins the real classes only', () => {
    expect(classNames('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('isoToLocalInput / localInputToIso', () => {
  it('round-trips an ISO instant through a datetime-local value', () => {
    const iso = new Date('2026-11-03T14:30:00.000Z').toISOString()
    const local = isoToLocalInput(iso)
    expect(localInputToIso(local)).toBe(iso)
  })
  it('empty or missing input gives empty/null', () => {
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput(undefined)).toBe('')
    expect(isoToLocalInput('not a date')).toBe('')
    expect(localInputToIso('')).toBeNull()
  })
})
