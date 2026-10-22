import { describe, expect, it } from 'vitest'
import { pickingTotals, type PickingRow } from '../lib/picking'
import { localDay } from '../lib/localDay'
import { allFields, optionLabel, PREOP_SCHEMAS, schemaFor } from '../lib/preopForm'
import { contactState } from '../lib/cadence'

const item = (name: string, cat = '') => ({ name, catalog_number: cat, company: null })
const rows: PickingRow[] = [
  { procedure_id: 'knee', item_id: 'tray', qty_per_case: 1, scales_with_cases: false, item: item('מגש') },
  { procedure_id: 'knee', item_id: 'femur', qty_per_case: 2, scales_with_cases: true, item: item('שתל', 'F1') },
  { procedure_id: 'hip', item_id: 'femur', qty_per_case: 1, scales_with_cases: true, item: item('שתל', 'F1') },
  { procedure_id: 'hip', item_id: 'blade', qty_per_case: 3, scales_with_cases: true, item: item('להב') },
  { procedure_id: 'hip', item_id: 'gone', qty_per_case: 9, scales_with_cases: true, item: null },
]

describe('picking list', () => {
  it('a per-case item grows with the surgeries, a fixed one does not, the same item of two procedures is one line', () => {
    const t = pickingTotals(rows, [{ procedure_id: 'knee', count: 2 }, { procedure_id: 'hip', count: 3 }])
    const by = Object.fromEntries(t.map((x) => [x.itemId, x]))
    expect(by.tray.total).toBe(1)
    expect(by.femur.total).toBe(2 * 2 + 1 * 3)
    expect(by.femur.detail).toEqual(['2×2', '1×3'])
    expect(by.blade.total).toBe(9)
    expect(by.gone).toBeUndefined() // a row whose item was deleted
  })
  it('two lines of the same surgery: the fixed tray is sent once, the per-case items add up', () => {
    const t = pickingTotals(rows, [{ procedure_id: 'knee', count: 1 }, { procedure_id: 'knee', count: 2 }])
    expect(t.find((x) => x.itemId === 'tray')?.total).toBe(1)
    expect(t.find((x) => x.itemId === 'femur')?.total).toBe(6)
  })
  it('ignores empty lines, a zero / negative / NaN count and unknown procedures; sorted in Hebrew order', () => {
    expect(pickingTotals(rows, [{ procedure_id: '', count: 3 }, { procedure_id: 'knee', count: 0 }, { procedure_id: 'knee', count: -1 }, { procedure_id: 'knee', count: NaN }, { procedure_id: 'x', count: 2 }])).toEqual([])
    const t = pickingTotals(rows, [{ procedure_id: 'hip', count: 1 }, { procedure_id: 'knee', count: 1 }])
    expect(t.map((x) => x.name)).toEqual(['להב', 'מגש', 'שתל'])
  })
  it('no equipment at all', () => expect(pickingTotals([], [{ procedure_id: 'knee', count: 2 }])).toEqual([]))
})

describe('local day of a timestamp', () => {
  it('is the day of the local clock, not of UTC', () => {
    // 23:30 UTC on the 5th is the 6th after midnight in any zone east of UTC+0:30; in UTC itself it is the 5th
    const iso = '2026-03-05T23:30:00Z'
    const local = new Date(iso)
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
    expect(localDay(iso)).toBe(expected)
  })
  it('handles nothing and garbage', () => {
    expect(localDay(null)).toBeNull()
    expect(localDay('')).toBeNull()
    expect(localDay('not a date')).toBeNull()
  })
})

describe('pre-op forms', () => {
  it('has the three MAKO schemas with unique field keys', () => {
    expect(PREOP_SCHEMAS.map((s) => s.id)).toEqual(['mako_tka', 'mako_tha', 'mako_pka'])
    for (const s of PREOP_SCHEMAS) {
      const keys = allFields(s).map((f) => f.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
  it('shows signed values with their word and falls back to the raw value for old data', () => {
    const f = allFields(schemaFor('mako_tka')!).find((x) => x.key === 'fem_coronal')!
    expect(optionLabel(f, '2.5')).toBe('Valgus 2.5°')
    expect(optionLabel(f, '-1')).toBe('Varus 1°')
    expect(optionLabel(f, '0')).toBe('0°')
    expect(optionLabel(f, 'legacy text')).toBe('legacy text')
    expect(optionLabel(f, '')).toBe('')
    expect(optionLabel(f, null)).toBe('')
  })
  it('an unknown template has no schema', () => {
    expect(schemaFor('generic')).toBeNull()
    expect(schemaFor(undefined)).toBeNull()
  })
})

describe('"last activity" of the profile header = the last meeting that took place', () => {
  const doc = { id: 'd', contact_cadence_days: null, created_at: '2026-01-01T00:00:00Z' }
  const mt = (date: string, status: string) => ({ meeting_date: date, status, meeting_doctors: [{ doctor: { id: 'd' } }] })
  it('a booked future meeting, a cancelled one and a "scheduled" one in the past do not count', () => {
    const today = new Date()
    const iso = (n: number) => {
      const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n)
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }
    const s = contactState(doc, [mt(iso(2), 'scheduled'), mt(iso(-1), 'cancelled'), mt(iso(-5), 'scheduled'), mt(iso(-9), 'done'), mt(iso(-30), 'done')])
    expect(s.lastDate).toBe(iso(-9))
    expect(s.nextMeeting).toBe(iso(2))
    expect(contactState(doc, [mt(iso(3), 'scheduled')]).lastDate).toBeNull()
  })
})
