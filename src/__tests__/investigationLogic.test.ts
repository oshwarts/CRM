import { describe, expect, it } from 'vitest'
import { ageDays, closeBlocker, filterInvestigations, investigationStats, lateness, noFilters, sortInvestigations, type InvLike } from '../lib/investigationLogic'

const today = '2026-10-22'
const inv = (o: Partial<InvLike> = {}): InvLike => ({
  event_date: '2026-10-20', status: 'open', closed_on: null, severity: 2, title: 'תקלה', problem: 'בעיה', root_cause: '', solution: '', product: '', categories: [],
  hospital_id: null, doctors: [], contacts: [], staff: [], ...o,
})

describe('how late an investigation is', () => {
  it('counts the days it has been open, and how long a closed one took', () => {
    expect(ageDays(inv({ event_date: '2026-10-12' }), today)).toBe(10)
    expect(ageDays(inv({ event_date: '2026-10-01', status: 'closed', closed_on: '2026-10-11' }), today)).toBe(10)
  })
  it('is late after 14 days and very late after 30, only while open', () => {
    expect(lateness(inv({ event_date: '2026-10-10' }), today)).toBe('ok')
    expect(lateness(inv({ event_date: '2026-10-08' }), today)).toBe('late')
    expect(lateness(inv({ event_date: '2026-09-20' }), today)).toBe('very-late')
    expect(lateness(inv({ event_date: '2026-01-01', status: 'closed', closed_on: '2026-01-05' }), today)).toBe('ok')
  })
})

describe('filtering and sorting', () => {
  const list = [
    inv({ title: 'שתל לא נכנס', doctors: [{ id: 'd1', name: 'יוסי כהן' }], categories: ['תהליך / שיטה'], severity: 3, hospital_id: 'h1' }),
    inv({ title: 'עיכוב משלוח', staff: [{ id: 'u1', full_name: 'דנה לוי' }], event_date: '2026-09-01' }),
    inv({ title: 'ישן', status: 'closed', closed_on: '2026-08-02', event_date: '2026-08-01' }),
  ]
  it('shows the open ones by default, and finds by doctor, hospital, category, severity, text and people', () => {
    expect(filterInvestigations(list, noFilters, today)).toHaveLength(2)
    expect(filterInvestigations(list, { ...noFilters, status: 'all' }, today)).toHaveLength(3)
    expect(filterInvestigations(list, { ...noFilters, doctorId: 'd1' }, today).map((i) => i.title)).toEqual(['שתל לא נכנס'])
    expect(filterInvestigations(list, { ...noFilters, hospitalId: 'h1' }, today)).toHaveLength(1)
    expect(filterInvestigations(list, { ...noFilters, category: 'תהליך / שיטה' }, today)).toHaveLength(1)
    expect(filterInvestigations(list, { ...noFilters, severity: 3 }, today)).toHaveLength(1)
    expect(filterInvestigations(list, { ...noFilters, q: 'דנה' }, today).map((i) => i.title)).toEqual(['עיכוב משלוח'])
    expect(filterInvestigations(list, { ...noFilters, lateOnly: true }, today).map((i) => i.title)).toEqual(['עיכוב משלוח'])
  })
  it('puts the most severe open ones first, then the oldest, then the closed ones', () => {
    expect(sortInvestigations(list).map((i) => i.title)).toEqual(['שתל לא נכנס', 'עיכוב משלוח', 'ישן'])
  })
})

describe('stats', () => {
  it('counts open, closed, late, severe and the categories', () => {
    const s = investigationStats(
      [inv({ categories: ['טעות אנוש'], severity: 3 }), inv({ categories: ['טעות אנוש', 'תיעוד / מסמכים'], event_date: '2026-09-01' }), inv({ status: 'closed', closed_on: '2026-10-01' })],
      today,
    )
    expect(s).toMatchObject({ open: 2, closed: 1, late: 1, high: 1 })
    expect(s.byCategory[0]).toEqual({ category: 'טעות אנוש', count: 2 })
  })
})

describe('closing', () => {
  it('needs the root cause, the solution and no open corrective actions', () => {
    expect(closeBlocker({ problem: 'x', root_cause: '', solution: 'y', openActions: 0 })).toContain('שורש')
    expect(closeBlocker({ problem: 'x', root_cause: 'z', solution: 'y', openActions: 2 })).toContain('2 פעולות')
    expect(closeBlocker({ problem: 'x', root_cause: 'z', solution: 'y', openActions: 0 })).toBe('')
  })
})
