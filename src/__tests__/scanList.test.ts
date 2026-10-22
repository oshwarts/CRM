import { describe, expect, it } from 'vitest'
import { compareByWindow, inWindow, windowEnd, windowSummary } from '../lib/scanList'

const today = '2026-10-22'
const s = (surgery_date: string | null, status = 'planned', patient_name = 'א') => ({ surgery_date, status, patient_name })

describe('the scans that show when the screen opens', () => {
  it('a two-week window ends 14 days from today', () => {
    expect(windowEnd('w2', today)).toBe('2026-11-05')
    expect(windowEnd('w1', today)).toBe('2026-10-29')
    expect(windowEnd('all', today)).toBe('')
  })
  it('holds planned surgeries from today to the end of the window', () => {
    expect(inWindow(s('2026-10-22'), 'w2', today)).toBe(true)
    expect(inWindow(s('2026-11-05'), 'w2', today)).toBe(true)
    expect(inWindow(s('2026-11-06'), 'w2', today)).toBe(false)
    expect(inWindow(s('2026-10-21'), 'w2', today)).toBe(false)
  })
  it('leaves out done, cancelled and postponed surgeries and scans without a date', () => {
    for (const st of ['done', 'cancelled', 'postponed']) expect(inWindow(s('2026-10-25', st), 'w2', today)).toBe(false)
    expect(inWindow(s(null), 'w2', today)).toBe(false)
  })
  it('the past window holds the surgeries before today, whatever happened to them; all holds everything', () => {
    expect(inWindow(s('2026-10-01', 'done'), 'past', today)).toBe(true)
    expect(inWindow(s('2026-10-22'), 'past', today)).toBe(false)
    expect(inWindow(s(null, 'postponed'), 'all', today)).toBe(true)
  })
  it('sorts the nearest surgery first, the past window latest first, no date last', () => {
    const list = [s('2026-10-30', 'planned', 'ג'), s(null, 'planned', 'ב'), s('2026-10-23', 'planned', 'ד')]
    expect([...list].sort(compareByWindow('w2')).map((x) => x.surgery_date)).toEqual(['2026-10-23', '2026-10-30', null])
    expect([...list].sort(compareByWindow('past')).map((x) => x.surgery_date)).toEqual(['2026-10-30', '2026-10-23', null])
  })
  it('describes the window', () => {
    expect(windowSummary('w2', today)).toContain('05/11')
  })
})
