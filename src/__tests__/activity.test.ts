import { describe, expect, it } from 'vitest'
import { ALL_KINDS, buildFeed, defaultFeedFilters, filterFeed, groupByDay, unreadItems, weekSummary, type FeedInput } from '../lib/activity'

const base: FeedInput = { names: { u1: 'דנה', u2: 'יוסי' }, meetings: [], investigations: [], doctors: [], stages: [], processes: [] }
const meeting = (id: string, o: Partial<FeedInput['meetings'][number]> = {}): FeedInput['meetings'][number] => ({
  id, subject: `פגישה ${id}`, meeting_date: '2026-10-20', status: 'done', summary: '', decisions: '', created_by: 'u1', created_at: '2026-10-20T08:00:00Z', updated_at: '2026-10-20T08:00:00Z',
  hospital: { name: 'שיבא' }, meeting_doctors: [{ doctor: { id: 'd1', name: 'כהן' } }], ...o,
})
const today = '2026-10-22'

describe('the feed', () => {
  it('makes one item per meeting with who wrote it, the doctors and the hospital, newest first', () => {
    const f = buildFeed({ ...base, meetings: [meeting('a'), meeting('b', { created_at: '2026-10-21T08:00:00Z', updated_at: '2026-10-21T08:00:00Z', created_by: 'u2' })] })
    expect(f.map((x) => x.id)).toEqual(['m-b', 'm-a'])
    expect(f[1]).toMatchObject({ kind: 'meeting', actorName: 'דנה', hospital: 'שיבא', to: '/meetings/a' })
    expect(f[1].doctors).toEqual([{ id: 'd1', name: 'כהן' }])
  })
  it('a summary written hours after the meeting was opened is a news of its own, with the summary line', () => {
    const f = buildFeed({ ...base, meetings: [meeting('a', { summary: 'דנו במחירים והוסכם על הדגמה', updated_at: '2026-10-21T10:00:00Z' }), meeting('b', { summary: 'כתוב מיד' })] })
    expect(f.find((x) => x.id === 'm-a')).toMatchObject({ kind: 'meeting_summary', at: '2026-10-21T10:00:00Z', summary: 'דנו במחירים והוסכם על הדגמה' })
    expect(f.find((x) => x.id === 'm-b')?.kind).toBe('meeting')
  })
  it('lists investigations when opened and when closed, a new doctor, and a change of stage but not the first stage', () => {
    const f = buildFeed({
      ...base,
      investigations: [{ id: 'i1', title: 'תקלה', problem: 'השתל לא נכנס', event_date: '2026-10-10', status: 'closed', closed_on: '2026-10-20', closed_by: 'u2', created_by: 'u1', created_at: '2026-10-10T08:00:00Z', doctors: [{ id: 'd1', name: 'כהן' }], hospital: null }],
      doctors: [{ id: 'd1', name: 'כהן', title: 'ד״ר', created_at: '2026-10-05T08:00:00Z', created_by: 'u1' }],
      stages: [{ doctor_id: 'd1', stage: 'הדגמה', previous_stage: 'ליד', changed_at: '2026-10-18T08:00:00Z' }, { doctor_id: 'd1', stage: 'ליד', previous_stage: '', changed_at: '2026-10-05T08:00:00Z' }],
    })
    expect(f.map((x) => x.kind)).toEqual(['investigation_closed', 'stage', 'investigation_open', 'doctor'])
    expect(f[0].actorName).toBe('יוסי')
    expect(f[1].summary).toBe('ליד ← הדגמה')
  })
})

describe('filters, unread and days', () => {
  const feed = buildFeed({ ...base, meetings: [meeting('a'), meeting('old', { created_at: '2026-06-01T08:00:00Z', updated_at: '2026-06-01T08:00:00Z' }), meeting('x', { created_by: 'u2', meeting_doctors: [{ doctor: { id: 'd2', name: 'לוי' } }], created_at: '2026-10-21T08:00:00Z', updated_at: '2026-10-21T08:00:00Z' })] })
  it('keeps the last 30 days by default and filters by doctor, kind and words', () => {
    expect(filterFeed(feed, defaultFeedFilters, today).map((x) => x.id)).toEqual(['m-x', 'm-a'])
    expect(filterFeed(feed, { ...defaultFeedFilters, doctorId: 'd2' }, today).map((x) => x.id)).toEqual(['m-x'])
    expect(filterFeed(feed, { ...defaultFeedFilters, kinds: ['doctor'] }, today)).toEqual([])
    expect(filterFeed(feed, { ...defaultFeedFilters, q: 'יוסי' }, today).map((x) => x.id)).toEqual(['m-x'])
    expect(filterFeed(feed, { ...defaultFeedFilters, days: 365 }, today)).toHaveLength(3)
  })
  it('counts as new what is after the last look, not my own, and of a wanted kind', () => {
    expect(unreadItems(feed, '2026-10-19T00:00:00Z', 'u1', ALL_KINDS).map((x) => x.id)).toEqual(['m-x'])
    expect(unreadItems(feed, '2026-10-19T00:00:00Z', 'someone', ALL_KINDS).map((x) => x.id)).toEqual(['m-x', 'm-a'])
    expect(unreadItems(feed, '2026-10-19T00:00:00Z', 'someone', ['doctor'])).toEqual([])
  })
  it('groups by day', () => {
    expect(groupByDay(feed).map((g) => [g.day, g.items.length])).toEqual([['2026-10-21', 1], ['2026-10-20', 1], ['2026-06-01', 1]])
  })
})

describe('the week', () => {
  it('counts the last 7 days, the busiest people and the hospitals with meetings', () => {
    const feed = buildFeed({ ...base, meetings: [meeting('a'), meeting('b'), meeting('c', { created_by: 'u2', hospital: { name: 'איכילוב' }, created_at: '2026-10-21T08:00:00Z', updated_at: '2026-10-21T08:00:00Z' }), meeting('old', { created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z' })] })
    const w = weekSummary(feed, today)
    expect(w.total).toBe(3)
    expect(w.counts.meeting).toBe(3)
    expect(w.busiest[0]).toEqual({ name: 'דנה', count: 2 })
    expect(w.hospitals[0]).toEqual({ name: 'שיבא', count: 2 })
  })
})

describe('titles', () => {
  it('an item always has a title to read and to open (a link without text cannot be used)', () => {
    const f = buildFeed({ ...base, meetings: [meeting('a', { subject: '  ' })] })
    expect(f[0].title).toBe('פגישה ללא נושא')
  })
})
