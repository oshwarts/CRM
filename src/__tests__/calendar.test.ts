import { describe, expect, it } from 'vitest'
import { fromMinutes, hourRange, iso, layoutOverlaps, monthWeeks, parseISO, rangeFor, shiftAnchor, toMinutes } from '../lib/calendar'

describe('calendar ranges', () => {
  it('a week starts on Sunday and has seven days', () => {
    const { days, from, to } = rangeFor('week', parseISO('2026-10-22')) // a Thursday
    expect(days).toHaveLength(7)
    expect(from).toBe('2026-10-18')
    expect(to).toBe('2026-10-24')
  })
  it('a month grid covers whole weeks around the month', () => {
    const weeks = monthWeeks(parseISO('2026-10-15'))
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(iso(weeks[0][0])).toBe('2026-09-27') // 1 Oct 2026 is a Thursday
    expect(iso(weeks[weeks.length - 1][6])).toBe('2026-10-31')
    const r = rangeFor('month', parseISO('2026-10-15'))
    expect(r.from).toBe('2026-09-27')
    expect(r.days.length % 7).toBe(0)
  })
  it('steps by a day, a week or a month', () => {
    expect(iso(shiftAnchor('day', parseISO('2026-10-31'), 1))).toBe('2026-11-01')
    expect(iso(shiftAnchor('week', parseISO('2026-10-22'), -1))).toBe('2026-10-15')
    expect(iso(shiftAnchor('month', parseISO('2026-01-31'), 1))).toBe('2026-02-28')
  })
})

describe('time and layout', () => {
  it('converts between hh:mm and minutes', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('09:30:00')).toBe(570)
    expect(fromMinutes(570)).toBe('09:30')
  })
  it('puts overlapping events in columns and keeps separate ones full width', () => {
    const l = layoutOverlaps([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 630 },
      { id: 'c', start: 700, end: 760 },
    ])
    expect(l.get('a')).toEqual({ col: 0, cols: 2 })
    expect(l.get('b')).toEqual({ col: 1, cols: 2 })
    expect(l.get('c')).toEqual({ col: 0, cols: 1 })
  })
  it('an event that starts when another ends does not overlap it', () => {
    const l = layoutOverlaps([{ id: 'a', start: 540, end: 600 }, { id: 'b', start: 600, end: 660 }])
    expect(l.get('a')!.cols).toBe(1)
    expect(l.get('b')!.cols).toBe(1)
  })
  it('the hour range is 7-20 and grows for events outside it', () => {
    expect(hourRange([])).toEqual({ from: 7, to: 20 })
    expect(hourRange([{ id: 'x', start: 6 * 60 + 30, end: 22 * 60 }])).toEqual({ from: 6, to: 22 })
  })
})
