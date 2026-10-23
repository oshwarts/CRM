import { describe, expect, it } from 'vitest'
import { attention, defaultProjectFilters, filterProjects, projectTotals, sortProjects, type ProjectRow } from '../lib/projectList'

const today = '2026-10-22'
const row = (id: string, o: Partial<ProjectRow['p']> = {}, s: Partial<ProjectRow['stats']> = {}): ProjectRow => ({
  p: { id, name: `פרויקט ${id}`, status: 'active', target_date: null, owner_id: 'u1', hospital_id: 'h1', hospital: { id: 'h1', name: 'שיבא' }, owner: { id: 'u1', full_name: 'דנה' }, ...o },
  stats: { total: 4, done: 1, percent: 25, blocked: [], overdue: [], next: [], ...s } as ProjectRow['stats'],
})
const task = {} as never

describe('what needs attention', () => {
  it('is high with a stuck task or a target date that passed, medium with a late task or a close target', () => {
    expect(attention(row('a', {}, { blocked: [task] }), today)).toBe('high')
    expect(attention(row('b', { target_date: '2026-10-01' }), today)).toBe('high')
    expect(attention(row('c', {}, { overdue: [task] }), today)).toBe('medium')
    expect(attention(row('d', { target_date: '2026-10-25' }), today)).toBe('medium')
    expect(attention(row('e', { target_date: '2026-12-25' }), today)).toBe('none')
    expect(attention(row('f', { status: 'done', target_date: '2026-01-01' }), today)).toBe('none')
  })
})

describe('the list', () => {
  const rows = [row('calm', { target_date: '2026-12-01' }), row('stuck', { target_date: '2026-11-01' }, { blocked: [task] }), row('late', { target_date: '2026-10-30' }, { overdue: [task] }), row('finished', { status: 'done' })]
  it('puts what needs attention first, then by date', () => {
    expect(sortProjects(filterProjects(rows, defaultProjectFilters, today, 'u1'), 'urgent', today).map((r) => r.p.id)).toEqual(['stuck', 'late', 'calm'])
  })
  it('shows the open ones by default; done and all by choice', () => {
    expect(filterProjects(rows, defaultProjectFilters, today, 'u1')).toHaveLength(3)
    expect(filterProjects(rows, { ...defaultProjectFilters, status: 'done' }, today, 'u1').map((r) => r.p.id)).toEqual(['finished'])
    expect(filterProjects(rows, { ...defaultProjectFilters, status: 'all' }, today, 'u1')).toHaveLength(4)
  })
  it('filters by words, owner, hospital and attention', () => {
    expect(filterProjects(rows, { ...defaultProjectFilters, q: 'stuck שיבא' }, today, 'u1').map((r) => r.p.id)).toEqual(['stuck'])
    expect(filterProjects(rows, { ...defaultProjectFilters, mine: true }, today, 'someone-else')).toHaveLength(0)
    expect(filterProjects(rows, { ...defaultProjectFilters, hospitalId: 'h9' }, today, 'u1')).toHaveLength(0)
    expect(filterProjects(rows, { ...defaultProjectFilters, attentionOnly: true }, today, 'u1')).toHaveLength(2)
  })
  it('sorts by target date, name and progress', () => {
    const open = filterProjects(rows, defaultProjectFilters, today, 'u1')
    expect(sortProjects(open, 'target', today).map((r) => r.p.id)).toEqual(['late', 'stuck', 'calm'])
    expect(sortProjects(open, 'name', today).map((r) => r.p.id)[0]).toBe('calm')
  })
  it('counts the totals', () => {
    expect(projectTotals(rows, today)).toMatchObject({ open: 3, done: 1, needAttention: 2, blocked: 1, overdue: 1 })
  })
})
