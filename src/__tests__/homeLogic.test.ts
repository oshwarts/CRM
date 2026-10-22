import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  agoLabel,
  countWord,
  favFollowUp,
  inDaysLabel,
  isMyMeeting,
  lateByLabel,
  meetingInfoByDoctor,
  meetingReminders,
  meetingsOnDays,
  scanAlerts,
  surgeryWindowEnd,
} from '../lib/homeLogic'
import { plusDaysISO, todayISO } from '../lib/utils'

// A fixed clock for the whole file, set before the describe blocks build their data (they run at collection time, before any beforeEach):
// local noon of Tuesday 20 October 2026. Nothing here depends on the real date.
const NOON = new Date(2026, 9, 20, 12, 0, 0)
vi.useFakeTimers()
vi.setSystemTime(NOON)
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.setSystemTime(NOON))

const d = (n: number) => plusDaysISO(n)
const T = () => todayISO()

const scan = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, status: 'planned', ct_date: null, surgery_date: null, scanned: false, disk_collected: false, plan_ready: false, rescan: false, rescan_date: null, rescan_done: false, ...o }) as never
const meeting = (id: string, date: string | null, status: string, o: Record<string, unknown> = {}) =>
  ({ id, meeting_date: date, meeting_time: null, status, responsible_agent_id: 'me', meeting_agents: [], meeting_doctors: [], next_followup_date: null, ...o }) as never

describe('isMyMeeting', () => {
  it('mine when responsible, a participant, or nobody is responsible', () => {
    expect(isMyMeeting({ responsible_agent_id: 'me', meeting_agents: [] }, 'me')).toBe(true)
    expect(isMyMeeting({ responsible_agent_id: 'x', meeting_agents: [{ agent: { id: 'me' } }] as never }, 'me')).toBe(true)
    expect(isMyMeeting({ responsible_agent_id: null, meeting_agents: [] }, 'me')).toBe(true)
    expect(isMyMeeting({ responsible_agent_id: 'x', meeting_agents: [{ agent: null }] as never }, 'me')).toBe(false)
  })
})

describe('surgeryWindowEnd', () => {
  it('a week / two / a month from today', () => {
    expect(surgeryWindowEnd('7', '', T(), plusDaysISO)).toBe(d(7))
    expect(surgeryWindowEnd('14', '', T(), plusDaysISO)).toBe(d(14))
    expect(surgeryWindowEnd('30', '', T(), plusDaysISO)).toBe(d(30))
  })
  it('a chosen date; a past, empty or broken date falls back to a week', () => {
    expect(surgeryWindowEnd('date', d(20), T(), plusDaysISO)).toBe(d(20))
    expect(surgeryWindowEnd('date', T(), T(), plusDaysISO)).toBe(T())
    expect(surgeryWindowEnd('date', d(-1), T(), plusDaysISO)).toBe(d(7))
    expect(surgeryWindowEnd('date', '', T(), plusDaysISO)).toBe(d(7))
    expect(surgeryWindowEnd('date', 'garbage', T(), plusDaysISO)).toBe(d(7))
  })
})

describe('scanAlerts', () => {
  const list = [
    scan('soon', { ct_date: d(2), surgery_date: d(5) }),
    scan('edge7', { ct_date: d(7) }),
    scan('out8', { ct_date: d(8) }),
    scan('today', { ct_date: d(0), surgery_date: d(0), disk_collected: true, plan_ready: true }),
    scan('late', { ct_date: d(-3) }),
    scan('doneCt', { ct_date: d(-3), scanned: true, disk_collected: true, plan_ready: true }),
    scan('cancelled', { status: 'cancelled', ct_date: d(-2), surgery_date: d(1) }),
    scan('noCt', { surgery_date: d(3) }),
    scan('noCtLater', { surgery_date: d(1) }),
    scan('noDisk', { ct_date: d(-1), scanned: true, surgery_date: d(2), plan_ready: true }),
    scan('far', { surgery_date: d(12) }),
    scan('pastSurgery', { surgery_date: d(-1) }),
  ]
  const a = scanAlerts(list, T(), d(7))
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id)
  it('CT within a week (today..+7), not yet scanned, soonest first', () => {
    expect(ids(a.upcoming)).toEqual(['today', 'soon', 'edge7'])
  })
  it('CT date passed and not scanned (cancelled excluded)', () => {
    expect(ids(a.overdue).sort()).toEqual(['late'])
  })
  it('surgery in the window without a CT, soonest first; cancelled and past surgeries excluded', () => {
    expect(ids(a.noCtSoon)).toEqual(['noCtLater', 'noCt'])
  })
  it('surgery in the window with a CT but no disk', () => {
    expect(ids(a.noDiskSoon)).toEqual(['noDisk', 'soon'])
  })
  it('the window moves with the selector', () => {
    expect(ids(scanAlerts(list, T(), d(14)).noCtSoon)).toEqual(['noCtLater', 'noCt', 'far'])
    expect(ids(scanAlerts(list, T(), d(0)).noCtSoon)).toEqual([])
  })
  it('a CT this week that still misses something', () => {
    expect(a.weekOpen.map((x) => x.s as unknown as { id: string }).map((x) => x.id)).toEqual(['today', 'soon', 'edge7'])
    expect(a.weekOpen.find((x) => (x.s as unknown as { id: string }).id === 'soon')?.missing).toEqual(['CT טרם בוצע', 'תוכנית לא מוכנה'])
  })
  it('re-scans: none / today / overdue / soon / done / far', () => {
    const r = scanAlerts(
      [
        scan('r1', { rescan: true }),
        scan('r2', { rescan: true, rescan_date: d(0) }),
        scan('r3', { rescan: true, rescan_date: d(-2) }),
        scan('r4', { rescan: true, rescan_date: d(7) }),
        scan('r5', { rescan: true, rescan_date: d(8) }),
        scan('r6', { rescan: true, rescan_date: d(1), rescan_done: true }),
      ],
      T(),
      d(7),
    ).rescans
    expect(r.map((x) => [(x.s as unknown as { id: string }).id, x.kind])).toEqual([
      ['r1', 'nodate'],
      ['r3', 'overdue'],
      ['r2', 'today'],
      ['r4', 'soon'],
    ])
  })
})

describe('midnight: the local day, not UTC', () => {
  it('23:59 and 00:01 are different days and the alerts move with them', () => {
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 30))
    expect(todayISO()).toBe('2026-10-20')
    const s = [scan('a', { ct_date: '2026-10-20' })]
    expect(scanAlerts(s, todayISO(), plusDaysISO(7)).upcoming).toHaveLength(1)
    vi.setSystemTime(new Date(2026, 9, 21, 0, 0, 30))
    expect(todayISO()).toBe('2026-10-21')
    expect(scanAlerts(s, todayISO(), plusDaysISO(7)).upcoming).toHaveLength(0)
    expect(scanAlerts(s, todayISO(), plusDaysISO(7)).overdue).toHaveLength(1)
  })
})

describe('meetings of a doctor, favourites follow-up, reminders', () => {
  const doc = (id: string) => ({ doctor: { id } })
  const ms = [
    meeting('m1', d(-10), 'done', { next_followup_date: d(-1), meeting_doctors: [doc('a')] }),
    meeting('m2', d(-40), 'done', { next_followup_date: d(30), meeting_doctors: [doc('a')] }),
    meeting('m3', d(5), 'scheduled', { meeting_doctors: [doc('b')] }),
    meeting('m4', d(-4), 'scheduled', { meeting_doctors: [doc('c')] }),
    meeting('m5', d(1), 'cancelled', { meeting_doctors: [doc('c')] }),
    meeting('m6', null, 'needs_followup', { meeting_doctors: [doc('c')] }),
    meeting('m7', d(-20), 'done', { meeting_doctors: [doc('e')] }),
    meeting('m8', d(-1), 'done', { next_followup_date: d(3), meeting_doctors: [doc('f')] }),
  ]
  const info = meetingInfoByDoctor(ms, T())
  it('last = latest meeting that took place; a closed-never "scheduled" one is not a meeting; cancelled / dateless ignored', () => {
    expect(info.get('a')).toMatchObject({ last: d(-10), followup: d(-1) })
    expect(info.get('b')).toEqual({ next: d(5) })
    expect(info.get('c')).toEqual({})
  })
  it('order: overdue, not scheduled (longest not met first), soon, later', () => {
    const out = favFollowUp([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'e' }, { id: 'f' }], info, T())
    expect(out.map((x) => [x.d.id, x.status])).toEqual([
      ['a', 'overdue'],
      ['c', 'none'],
      ['e', 'none'],
      ['f', 'soon'],
      ['b', 'soon'],
    ])
    expect(out.find((x) => x.d.id === 'f')?.isFollowup).toBe(true)
  })
  it('reminders: soon (today..+7) and missed, by date and time; only mine', () => {
    const r = meetingReminders(
      [
        meeting('x1', d(0), 'scheduled', { meeting_time: '14:00:00' }),
        meeting('x2', d(0), 'scheduled', { meeting_time: '08:30:00' }),
        meeting('x3', d(7), 'scheduled'),
        meeting('x4', d(8), 'scheduled'),
        meeting('x5', d(-1), 'scheduled'),
        meeting('x6', d(-5), 'scheduled'),
        meeting('x7', d(0), 'scheduled', { responsible_agent_id: 'other' }),
        meeting('x8', d(0), 'done'),
      ],
      'me',
      T(),
      d(7),
    )
    expect(r.soon.map((m) => (m as unknown as { id: string }).id)).toEqual(['x2', 'x1', 'x3'])
    expect(r.missed.map((m) => (m as unknown as { id: string }).id)).toEqual(['x6', 'x5'])
  })
  it('meetingsOnDays: today and tomorrow, not cancelled, by time', () => {
    const r = meetingsOnDays(
      [
        meeting('y1', d(1), 'scheduled', { meeting_time: '09:00:00' }),
        meeting('y2', d(0), 'scheduled', { meeting_time: '15:00:00' }),
        meeting('y3', d(0), 'cancelled'),
        meeting('y4', d(2), 'scheduled'),
        meeting('y5', d(0), 'scheduled', { meeting_time: '07:00:00', responsible_agent_id: null }),
      ],
      [d(0), d(1)],
      'me',
    )
    expect(r.map((m) => (m as unknown as { id: string }).id)).toEqual(['y5', 'y2', 'y1'])
  })
})

describe('Hebrew number words', () => {
  it('singular, dual and plural', () => {
    expect(countWord(1, 'פגישה אחת', 'פגישות')).toBe('פגישה אחת')
    expect(countWord(3, 'פגישה אחת', 'פגישות')).toBe('3 פגישות')
    expect(agoLabel(0)).toBe('היום')
    expect(agoLabel(1)).toBe('אתמול')
    expect(agoLabel(10)).toBe('לפני 10 ימים')
    expect(inDaysLabel(0)).toBe('היום')
    expect(inDaysLabel(1)).toBe('מחר')
    expect(inDaysLabel(2)).toBe('בעוד יומיים')
    expect(inDaysLabel(5)).toBe('בעוד 5 ימים')
    expect(lateByLabel(1)).toBe('באיחור של יום')
    expect(lateByLabel(2)).toBe('באיחור של יומיים')
    expect(lateByLabel(650)).toBe('באיחור של 650 ימים')
  })
})
