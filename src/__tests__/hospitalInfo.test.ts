import { describe, expect, it } from 'vitest'
import { perYear, totalPerYear } from '../lib/hospitalInfo'

describe('estimated cases of a hospital', () => {
  it('a monthly figure counts twelve times in a year', () => {
    expect(perYear({ cases: 30, period: 'year' })).toBe(30)
    expect(perYear({ cases: 5, period: 'month' })).toBe(60)
  })
  it('adds the procedures as cases a year', () => {
    expect(totalPerYear([{ cases: 100, period: 'year' }, { cases: 4, period: 'month' }])).toBe(148)
    expect(totalPerYear([])).toBe(0)
  })
})
