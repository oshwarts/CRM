import { describe, expect, it } from 'vitest'
import { inTab, sortMeetings } from '../lib/meetingList'
import { buildMailto } from '../lib/mail'
import { meetingMailText } from '../lib/meetingMail'
import type { MeetingWithRelations } from '../lib/types'

const T = '2026-10-20'
const mk = (id: string, date: string | null, status: string, o: Record<string, unknown> = {}) =>
  ({ id, meeting_date: date, status, meeting_time: null, next_followup_date: null, created_at: `2026-01-0${id.length}T00:00:00Z`, subject: id, summary: '', decisions: '', location: '', hospital: null, responsible_agent: null, extra_participants: '', meeting_doctors: [], meeting_agents: [], meeting_contacts: [], meeting_tasks: [], ...o }) as unknown as MeetingWithRelations
const ids = (l: MeetingWithRelations[]) => l.map((m) => m.id)

describe('inTab', () => {
  it('upcoming = scheduled today or later', () => {
    expect(inTab(mk('a', T, 'scheduled'), 'upcoming', T)).toBe(true)
    expect(inTab(mk('a', '2026-10-19', 'scheduled'), 'upcoming', T)).toBe(false) // date passed: not upcoming
    expect(inTab(mk('a', '2026-10-25', 'cancelled'), 'upcoming', T)).toBe(false)
    expect(inTab(mk('a', null, 'scheduled'), 'upcoming', T)).toBe(false)
  })
  it('past = before today, or done', () => {
    expect(inTab(mk('a', '2026-10-19', 'scheduled'), 'past', T)).toBe(true)
    expect(inTab(mk('a', '2026-11-01', 'done'), 'past', T)).toBe(true)
    expect(inTab(mk('a', T, 'scheduled'), 'past', T)).toBe(false)
  })
  it('followup = needs_followup, or a follow-up date on a meeting that is not done / cancelled', () => {
    expect(inTab(mk('a', T, 'needs_followup'), 'followup', T)).toBe(true)
    expect(inTab(mk('a', T, 'scheduled', { next_followup_date: '2026-11-01' }), 'followup', T)).toBe(true)
    expect(inTab(mk('a', T, 'done', { next_followup_date: '2026-11-01' }), 'followup', T)).toBe(false)
    expect(inTab(mk('a', T, 'cancelled', { next_followup_date: '2026-11-01' }), 'followup', T)).toBe(false)
    expect(inTab(mk('a', T, 'scheduled'), 'followup', T)).toBe(false)
  })
})

describe('sortMeetings', () => {
  const list = [mk('a', '2026-10-22', 'scheduled'), mk('b', null, 'scheduled'), mk('c', '2026-10-20', 'scheduled', { meeting_time: '14:00:00' }), mk('d', '2026-10-20', 'scheduled', { meeting_time: '08:00:00' })]
  it('all / past: newest first, undated last', () => expect(ids(sortMeetings(list, 'all'))).toEqual(['a', 'c', 'd', 'b']))
  it('upcoming: soonest first (by time within a day), undated last', () => expect(ids(sortMeetings(list, 'upcoming'))).toEqual(['d', 'c', 'a', 'b']))
  it('followup: by follow-up date', () => {
    const f = [mk('x', '2026-10-01', 'scheduled', { next_followup_date: '2026-12-01' }), mk('y', '2026-10-05', 'scheduled', { next_followup_date: '2026-11-01' }), mk('z', '2026-10-09', 'needs_followup')]
    expect(ids(sortMeetings(f, 'followup'))).toEqual(['z', 'y', 'x']) // z falls back to its meeting date
  })
  it('an undated meeting that is still waiting to be sent goes first, other undated ones stay last', () => {
    const l = [mk('a', '2026-10-22', 'scheduled'), mk('b', null, 'scheduled'), mk('c', null, 'scheduled')]
    expect(ids(sortMeetings(l, 'all', new Set(['c'])))).toEqual(['c', 'a', 'b'])
    expect(ids(sortMeetings(l, 'all'))).toEqual(['a', 'b', 'c'])
  })
  it('does not change the input', () => {
    const copy = ids(list)
    sortMeetings(list, 'upcoming')
    expect(ids(list)).toEqual(copy)
  })
})

describe('meeting mail', () => {
  it('a short summary goes whole into the mailto', () => {
    const { subject, body } = meetingMailText(mk('a', '2026-10-20', 'done', { subject: 'פגישה', summary: 'סיכום קצר' }), 'עומר')
    const r = buildMailto('', subject, body)
    expect(r.mode).toBe('full')
    expect(decodeURIComponent(r.url)).toContain('סיכום קצר')
  })
  it('a long summary falls back to a short note ("copied")', () => {
    const { subject, body } = meetingMailText(mk('a', '2026-10-20', 'done', { summary: 'ארוך '.repeat(800) }), '')
    const r = buildMailto('', subject, body)
    expect(r.mode).toBe('copied')
    expect(r.url.length).toBeLessThan(1900)
  })
  it('strips the "imported from mail" marker and omits empty parts', () => {
    const { body } = meetingMailText(mk('a', null, 'done', { summary: 'יובא ממייל: x\n\nתוכן אמיתי' }), '')
    expect(body).toContain('תוכן אמיתי')
    expect(body).not.toContain('יובא ממייל')
    expect(body).not.toContain('תאריך:')
    expect(body).not.toContain('בברכה')
  })
})
