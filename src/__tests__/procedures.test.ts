import { describe, expect, it } from 'vitest'
import { expandProcedure, groupParentIds, procedureGroups, withParentNames } from '../lib/procedures'
import { formatDays, toggleDay } from '../lib/clinics'

const list = [
  { id: 'a', name: 'GMRS', parent_id: null },
  { id: 'a2', name: 'ירך', parent_id: 'a' },
  { id: 'a1', name: 'ברך', parent_id: 'a' },
  { id: 'b', name: 'החלפת ברך', parent_id: null },
]

describe('procedures inside procedures', () => {
  it('groups the children under their parent, in name order', () => {
    const g = procedureGroups(list)
    expect(g.map((x) => x.parent.id)).toEqual(['a', 'b'].sort((x, y) => list.find((p) => p.id === x)!.name.localeCompare(list.find((p) => p.id === y)!.name, 'he')))
    expect(g.find((x) => x.parent.id === 'a')!.children.map((c) => c.id)).toEqual(['a1', 'a2'])
  })
  it('knows which procedures are only a group', () => {
    expect([...groupParentIds(list)]).toEqual(['a'])
  })
  it('a filter on a parent also matches its children, a filter on a child only itself', () => {
    expect([...expandProcedure('a', list)].sort()).toEqual(['a', 'a1', 'a2'])
    expect([...expandProcedure('a1', list)]).toEqual(['a1'])
  })
  it('names a sub-procedure "Parent › Child" and keeps it right after the parent', () => {
    const flat = withParentNames(list)
    const i = flat.findIndex((p) => p.id === 'a')
    expect(flat[i + 1].name).toBe('GMRS › ברך')
    expect(flat[i + 2].name).toBe('GMRS › ירך')
  })
  it('a child whose parent is missing from the list is shown as a procedure of its own', () => {
    expect(procedureGroups([{ id: 'x', name: 'יתום', parent_id: 'gone' }]).map((g) => g.parent.id)).toEqual(['x'])
  })
})

describe('clinic days', () => {
  it('formats the days in week order without duplicates', () => {
    expect(formatDays([4, 0, 2, 2])).toBe('א׳, ג׳, ה׳')
    expect(formatDays([])).toBe('')
    expect(formatDays(null)).toBe('')
  })
  it('toggles a day on and off, keeping the order', () => {
    expect(toggleDay([0, 4], 2)).toEqual([0, 2, 4])
    expect(toggleDay([0, 2, 4], 2)).toEqual([0, 4])
  })
})
