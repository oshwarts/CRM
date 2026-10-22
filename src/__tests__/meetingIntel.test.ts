import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { table: string; op: string; payload?: unknown }[] = []
let existing: Record<string, unknown> | null = null

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: existing ? [existing] : [], error: null }),
        single: () => Promise.resolve({ data: { name: 'Zimmer' }, error: null }),
        delete: () => {
          calls.push({ table, op: 'delete' })
          return chain
        },
        update: (payload: unknown) => {
          calls.push({ table, op: 'update', payload })
          return chain
        },
        insert: (payload: unknown) => {
          calls.push({ table, op: 'insert', payload })
          return Promise.resolve({ data: null, error: null })
        },
        then: (res: (v: unknown) => unknown) => res({ data: null, error: null }),
      }
      return chain
    },
  },
}))

import { syncMeetingIntel } from '../lib/meetingIntel'

const input = { competitor_notes: 'Zimmer מציעה הנחה', competitorId: 'c1', meeting_date: '2026-10-20', doctorIds: ['d1', 'd2'], hospitalId: 'h1' }

beforeEach(() => {
  calls.length = 0
  existing = null
})

describe('the competitor record of a meeting', () => {
  it('creates a record tied to the meeting, with the first doctor, the hospital, the date and the competitor', async () => {
    await syncMeetingIntel('m1', input)
    expect(calls).toEqual([{ table: 'competitor_intel', op: 'insert', payload: { competitor_id: 'c1', competitor: 'Zimmer', notes: 'Zimmer מציעה הנחה', intel_date: '2026-10-20', doctor_id: 'd1', hospital_id: 'h1', meeting_id: 'm1' } }])
  })
  it('updates the record it made and keeps the competitor when the person did not touch it', async () => {
    existing = { id: 'i1', competitor_id: 'c9', competitor: 'Stryker', outcome: 'open', image_paths: [] }
    await syncMeetingIntel('m1', { ...input, competitorId: undefined })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ op: 'update', payload: { competitor_id: 'c9', competitor: 'Stryker', notes: 'Zimmer מציעה הנחה' } })
  })
  it('removes a record that has nothing of its own when the text is cleared', async () => {
    existing = { id: 'i1', outcome: 'open', image_paths: [], price_per_case: null, implant_price: null }
    await syncMeetingIntel('m1', { ...input, competitor_notes: '  ' })
    expect(calls).toEqual([{ table: 'competitor_intel', op: 'delete' }])
  })
  it('keeps a record that has details of its own (a price, a tender...) when the text is cleared', async () => {
    existing = { id: 'i1', outcome: 'open', image_paths: [], price_per_case: 1000, implant_price: null }
    await syncMeetingIntel('m1', { ...input, competitor_notes: '' })
    expect(calls).toEqual([])
  })
  it('does nothing when there is no text and no record', async () => {
    await syncMeetingIntel('m1', { ...input, competitor_notes: '' })
    expect(calls).toEqual([])
  })
})
