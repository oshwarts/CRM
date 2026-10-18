import { describe, expect, it } from 'vitest'
import { DEFAULT_GROUPS, parseMenuGroups, resolveGroups } from '../lib/menuConfig'
import { whatsappNumber } from '../components/QuickContact'
import { suggestStatus } from '../lib/hospitalStats'
import { change } from '../lib/teamStats'

describe('menu groups', () => {
  const all = DEFAULT_GROUPS.flatMap((g) => g.paths)
  it('the default groups hold every page once', () => {
    expect(new Set(all).size).toBe(all.length)
  })
  it('a page missing from the saved groups joins the last one; a page named twice stays in the first', () => {
    const saved = [{ id: 'a', title: 'א', paths: ['/x', '/y'] }, { id: 'b', title: 'ב', paths: ['/y'] }]
    const r = resolveGroups(saved, ['/x', '/y', '/z'])
    expect(r[0].paths).toEqual(['/x', '/y'])
    expect(r[1].paths).toEqual(['/z'])
  })
  it('a page the person may not open is dropped', () => {
    const r = resolveGroups([{ id: 'a', title: 'א', paths: ['/x', '/admin'] }], ['/x'])
    expect(r[0].paths).toEqual(['/x'])
  })
  it('broken saved data falls back to nothing', () => {
    expect(parseMenuGroups('not json')).toBeNull()
    expect(parseMenuGroups('[]')).toBeNull()
    expect(parseMenuGroups(undefined)).toBeNull()
  })
})

describe('whatsapp numbers', () => {
  it('turns an Israeli number into the international form', () => {
    expect(whatsappNumber('052-123 4567')).toBe('972521234567')
    expect(whatsappNumber('+972521234567')).toBe('972521234567')
  })
})

describe('commercial status suggestion', () => {
  it('Mako is a client, another robot is a competitor, no robot is a prospect', () => {
    expect(suggestStatus(['Mako'])).toBe('client')
    expect(suggestStatus(['VELYS'])).toBe('competitor')
    expect(suggestStatus([])).toBe('potential')
  })
})

describe('change against the previous period', () => {
  it('gives the percent, and nothing to compare with when the previous is zero', () => {
    expect(change(6, 3)).toMatchObject({ value: 6, prev: 3, pct: 100 })
    expect(change(2, 4).pct).toBe(-50)
    expect(change(5, 0).pct).toBeNull()
  })
})
