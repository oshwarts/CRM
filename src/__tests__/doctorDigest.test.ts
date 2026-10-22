import { describe, expect, it } from 'vitest'
import { buildDigest, meetingNote, type DigestInput } from '../lib/doctorDigest'

const base: DigestInput = { doctorId: 'd1', today: '2026-10-22', meetings: [], scans: [], investigations: [], stages: [], tasks: [] }
const meeting = (id: string, date: string | null, o: Partial<DigestInput['meetings'][number]> = {}) => ({ id, subject: `פגישה ${id}`, meeting_date: date, status: 'done', summary: '', decisions: '', competitor_notes: '', ...o })
const scan = (date: string, status = 'done', surgeon = 'd1') => ({ surgery_date: date, status, surgeon_id: surgeon })

describe('doctor digest', () => {
  it('counts meetings in the period and the one before, not cancelled or future ones', () => {
    const d = buildDigest(
      { ...base, meetings: [meeting('a', '2026-10-10'), meeting('b', '2026-09-30'), meeting('c', '2026-09-05'), meeting('x', '2026-10-12', { status: 'cancelled' }), meeting('f', '2026-11-05', { status: 'scheduled' })] },
      'month',
    )
    expect(d.meetings.count).toBe(2) // a, b (30 days back from 22/10 is 23/9)
    expect(d.meetings.previous).toBe(1) // c
    expect(d.meetings.lastDate).toBe('2026-10-10')
  })
  it('longer periods reach further back', () => {
    const input = { ...base, meetings: [meeting('old', '2026-03-01')] }
    expect(buildDigest(input, 'quarter').meetings.count).toBe(0)
    expect(buildDigest(input, 'year').meetings.count).toBe(1)
  })
  it('shows what was decided, else the summary, cut short', () => {
    expect(meetingNote({ summary: 'סיכום', decisions: 'החלטה' })).toBe('החלטה')
    expect(meetingNote({ summary: 'סיכום', decisions: '' })).toBe('סיכום')
    expect(meetingNote({ summary: 'א'.repeat(300), decisions: '' }).length).toBe(140)
  })
  it('counts the surgeries of this doctor only, with the comparison to the period before', () => {
    const d = buildDigest(
      { ...base, scans: [scan('2026-10-01'), scan('2026-10-05'), scan('2026-10-06', 'done', 'other'), scan('2026-09-01'), scan('2026-09-02'), scan('2026-09-03'), scan('2026-10-08', 'postponed'), scan('2026-10-09', 'cancelled'), scan('2026-10-30', 'planned')] },
      'month',
    )
    expect(d.surgeries).toMatchObject({ done: 2, previous: 3, postponed: 1, cancelled: 1, upcoming: 1 })
  })
  it('warns about a long silence, an open investigation, a drop in surgeries and late tasks', () => {
    const d = buildDigest(
      {
        ...base,
        meetings: [meeting('a', '2026-07-01')],
        investigations: [{ id: 'i', title: 'תקלה', event_date: '2026-10-01', status: 'open', closed_on: null, root_cause: '', solution: '' }],
        scans: [scan('2026-09-01'), scan('2026-09-02'), scan('2026-09-03'), scan('2026-10-01')],
        tasks: [{ is_done: false, due_date: '2026-10-01' }, { is_done: true, due_date: '2026-09-01' }],
      },
      'month',
    )
    const texts = d.alerts.map((a) => a.text).join('|')
    expect(texts).toContain('לא הייתה פגישה כבר')
    expect(texts).toContain('תחקיר פתוח')
    expect(texts).toContain('ירידה בניתוחים')
    expect(texts).toContain('משימה אחת באיחור')
  })
  it('says there was never a meeting when there is none', () => {
    expect(buildDigest(base, 'month').alerts[0].text).toBe('עדיין לא הייתה פגישה עם הרופא')
  })
  it('lists stage changes of the period', () => {
    const d = buildDigest({ ...base, stages: [{ stage: 'הדגמה', previous_stage: 'ליד', changed_at: '2026-10-10T08:00:00Z' }, { stage: 'ליד', previous_stage: '', changed_at: '2025-01-01T08:00:00Z' }] }, 'month')
    expect(d.stages.list).toEqual([{ stage: 'הדגמה', previous: 'ליד', date: '2026-10-10' }])
  })
})
