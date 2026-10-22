import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNow, type NowGroupId, type NowInput } from '../lib/nowLogic'
import { competitorAlerts, newActivity } from '../lib/competitors'
import { DEFAULT_THRESHOLDS } from '../lib/pipelineStats'
import { plusDaysISO } from '../lib/utils'

// A fixed clock: local noon of Tuesday 20 October 2026. Nothing here depends on the real date.
const NOON = new Date(2026, 9, 20, 12, 0, 0)
vi.useFakeTimers()
vi.setSystemTime(NOON)
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.setSystemTime(NOON))

const d = (n: number) => plusDaysISO(n)
const ts = (n: number) => new Date(NOON.getTime() + n * 86_400_000).toISOString()

const task = (id: string, due: string | null, o: Record<string, unknown> = {}) =>
  ({ id, description: `משימה ${id}`, due_date: due, priority: 'normal', assignee_id: 'me', is_done: false, status: 'open', doctor: null, hospital: null, ...o }) as never
const meeting = (id: string, date: string | null, o: Record<string, unknown> = {}) =>
  ({ id, subject: `פגישה ${id}`, meeting_date: date, meeting_time: '10:00:00', status: 'scheduled', responsible_agent_id: 'me', meeting_agents: [], meeting_doctors: [], hospital: null, ...o }) as never
const scan = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, patient_name: `מטופל ${id}`, procedure_type: 'knee', hospital: { id: 'h1', name: 'שיבא' }, ct_date: null, surgery_date: null, scanned: false, disk_collected: false, plan_ready: true, rescan: false, rescan_date: null, rescan_done: false, status: 'planned', ...o }) as never
const doctor = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, name: `רופא ${id}`, title: 'ד״ר', status: 'client', pipeline_stage: '', next_step: '', next_step_date: null, contact_cadence_days: null, created_at: '2026-01-01T00:00:00Z', created_by: 'other', doctor_hospitals: [], ...o }) as never
const intel = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, competitor: 'Stryker', product: '', outcome: 'open', hospital_id: 'h1', contract_end: null, tender_due: null, tender_name: '', intel_date: d(-1), created_at: ts(-30), created_by: 'other', hospital: { id: 'h1', name: 'שיבא' }, doctor: null, ...o }) as never

const base = (o: Partial<NowInput> = {}): NowInput => ({
  userId: 'me', isAdmin: false, isDeveloper: false, tasks: [], meetings: [], scans: [], doctors: [], favorites: [], intel: [], myHospitals: [], stageHistory: [],
  thresholds: DEFAULT_THRESHOLDS, uploads: [], procRequests: [], suggestions: [], lastBackup: undefined, ...o,
})
const group = (i: NowInput, id: NowGroupId) => buildNow(i).find((g) => g.id === id)?.items ?? []
const keys = (i: NowInput, id: NowGroupId) => group(i, id).map((x) => x.key)
const allKeys = (i: NowInput) => buildNow(i).flatMap((g) => g.items.map((x) => `${g.id}:${x.key}`))

describe('empty', () => {
  it('nothing → no groups', () => expect(buildNow(base())).toEqual([]))
  it('a group without items is left out', () => expect(buildNow(base({ tasks: [task('1', d(30))] }))).toEqual([]))
})

describe('tasks: day boundaries and "mine"', () => {
  const i = base({ tasks: [task('y', d(-1)), task('t', d(0)), task('tm', d(1)), task('w', d(7)), task('w8', d(8)), task('none', null)] })
  it('yesterday is late', () => expect(keys(i, 'late')).toEqual(['ty']))
  it('today is today', () => expect(keys(i, 'today')).toEqual(['tt']))
  it('tomorrow and day +7 are this week, +8 is not, no date is nowhere', () => expect(keys(i, 'soon')).toEqual(['ttm', 'tw']))
  it('done tasks (either flag) are ignored', () => {
    const j = base({ tasks: [task('a', d(-3), { is_done: true }), task('b', d(-3), { status: 'done' }), task('c', d(-3))] })
    expect(keys(j, 'late')).toEqual(['tc'])
  })
  it('only my tasks, also for a manager', () => {
    const j = base({ isAdmin: true, tasks: [task('a', d(-3), { assignee_id: 'other' }), task('b', d(-3), { assignee_id: null }), task('c', d(-3))] })
    expect(keys(j, 'late')).toEqual(['tc'])
  })
  it('no signed-in user → nothing', () => expect(buildNow(base({ userId: undefined, tasks: [task('a', d(-3), { assignee_id: null })] }))).toEqual([]))
  it('late: the oldest first', () => {
    const j = base({ tasks: [task('a', d(-1)), task('b', d(-10)), task('c', d(-5))] })
    expect(keys(j, 'late')).toEqual(['tb', 'tc', 'ta'])
  })
  it('today: an urgent task comes first, and says so', () => {
    const j = base({ tasks: [task('a', d(0)), task('b', d(0), { priority: 'urgent', doctor: { name: 'כהן' }, hospital: { name: 'שיבא' } })] })
    expect(keys(j, 'today')).toEqual(['tb', 'ta'])
    expect(group(j, 'today')[0].sub).toBe('כהן · שיבא · דחוף')
  })
  it('the chip shows the due date as dd/MM/yyyy and links to the tasks', () => {
    const it = group(base({ tasks: [task('a', '2026-10-19')] }), 'late')[0]
    expect(it.when).toBe('19/10/2026')
    expect(it.to).toBe('/tasks')
  })
  it('crossing a month and a year boundary', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23, 30))
    const j = base({ tasks: [task('a', '2026-12-31'), task('b', '2027-01-01'), task('c', '2027-01-07'), task('d', '2027-01-08'), task('e', '2026-12-30')] })
    expect(keys(j, 'today')).toEqual(['ta'])
    expect(keys(j, 'soon')).toEqual(['tb', 'tc'])
    expect(keys(j, 'late')).toEqual(['te'])
  })
  it('just after midnight is the new day (local, not UTC)', () => {
    vi.setSystemTime(new Date(2026, 9, 21, 0, 5))
    const j = base({ tasks: [task('a', '2026-10-20'), task('b', '2026-10-21')] })
    expect(keys(j, 'late')).toEqual(['ta'])
    expect(keys(j, 'today')).toEqual(['tb'])
  })
})

describe('meetings', () => {
  it('only scheduled meetings with a date', () => {
    const i = base({ meetings: [meeting('a', d(-2)), meeting('b', d(-2), { status: 'done' }), meeting('c', d(-2), { status: 'cancelled' }), meeting('d', null), meeting('e', d(-2), { status: 'needs_followup' })] })
    expect(keys(i, 'late')).toEqual(['ma'])
  })
  it('a late meeting tells the person what to do', () => {
    const it = group(base({ meetings: [meeting('a', d(-2), { meeting_doctors: [{ doctor: { name: 'כהן' } }], hospital: { name: 'שיבא' } })] }), 'late')[0]
    expect(it.sub).toBe('עבר המועד — עדכן סיכום או קבע מחדש · כהן · שיבא')
    expect(it.to).toBe('/meetings/a')
  })
  it('a late meeting without doctor and hospital has no dangling separator', () => {
    expect(group(base({ meetings: [meeting('a', d(-2))] }), 'late')[0].sub).toBe('עבר המועד — עדכן סיכום או קבע מחדש')
  })
  it('mine: responsible, one of the agents, or nobody responsible', () => {
    const i = base({
      meetings: [
        meeting('own', d(0)),
        meeting('other', d(0), { responsible_agent_id: 'x' }),
        meeting('joined', d(0), { responsible_agent_id: 'x', meeting_agents: [{ agent: { id: 'me' } }] }),
        meeting('nobody', d(0), { responsible_agent_id: null }),
        meeting('nullagent', d(0), { responsible_agent_id: 'x', meeting_agents: [{ agent: null }] }),
      ],
    })
    expect(keys(i, 'today').sort()).toEqual(['mjoined', 'mnobody', 'mown'])
  })
  it('today: ordered by time, a meeting without a time after the timed ones', () => {
    const i = base({ meetings: [meeting('c', d(0), { meeting_time: null }), meeting('b', d(0), { meeting_time: '14:30:00' }), meeting('a', d(0), { meeting_time: '08:00:00' })] })
    expect(keys(i, 'today')).toEqual(['ma', 'mb', 'mc'])
    expect(group(i, 'today')[1].when.endsWith('14:30')).toBe(true)
    expect(group(i, 'today')[2].when).not.toMatch(/ $/)
  })
  it('a meeting without a subject is called "פגישה"', () => expect(group(base({ meetings: [meeting('a', d(0), { subject: '' })] }), 'today')[0].title).toBe('פגישה'))
  it('this week: +1 .. +7 only', () => {
    const i = base({ meetings: [meeting('a', d(1)), meeting('b', d(7)), meeting('c', d(8))] })
    expect(keys(i, 'soon')).toEqual(['ma', 'mb'])
  })
  it('the week mixes meetings and tasks by date', () => {
    const i = base({ tasks: [task('a', d(3)), task('b', d(1))], meetings: [meeting('c', d(2)), meeting('d', d(3), { meeting_time: '08:00:00' })] })
    expect(keys(i, 'soon')).toEqual(['tb', 'mc', 'md', 'ta'])
  })
})

describe('scans: one row per scan, in its most urgent group', () => {
  it('CT and surgery both today → ONE row in "today" listing both', () => {
    const i = base({ scans: [scan('1', { ct_date: d(0), surgery_date: d(0) })] })
    expect(allKeys(i)).toEqual(['today:s1'])
    expect(group(i, 'today')[0].sub).toContain('CT היום')
    expect(group(i, 'today')[0].sub).toContain('ניתוח היום')
  })
  it('an unscanned CT from the past and a surgery today → one row, in "late"', () => {
    const i = base({ scans: [scan('1', { ct_date: d(-2), surgery_date: d(0) })] })
    expect(allKeys(i)).toEqual(['late:s1'])
    expect(group(i, 'late')[0].sub).toMatch(/CT עבר ולא נסרק · ניתוח היום/)
    expect(group(i, 'late')[0].when).toBe(`CT ${d(-2).split('-').reverse().join('/')}`)
  })
  it('surgery today with a CT done but no disk → once, "today", says the disk is missing', () => {
    const i = base({ scans: [scan('1', { ct_date: d(-3), scanned: true, surgery_date: d(0) })] })
    expect(allKeys(i)).toEqual(['today:s1'])
    expect(group(i, 'today')[0].sub).toContain('ניתוח היום — הדיסק לא הועלה')
  })
  it('surgery today, nothing missing → "today" with no extra reason', () => {
    const i = base({ scans: [scan('1', { ct_date: d(-3), scanned: true, disk_collected: true, surgery_date: d(0) })] })
    expect(group(i, 'today')[0].sub).toBe('ניתוח היום · שיבא')
  })
  it('surgery today without any CT date', () => {
    expect(group(base({ scans: [scan('1', { surgery_date: d(0) })] }), 'today')[0].sub).toContain('אין תאריך CT')
  })
  it('CT yesterday: late only if not scanned', () => {
    expect(keys(base({ scans: [scan('1', { ct_date: d(-1) })] }), 'late')).toEqual(['s1'])
    expect(allKeys(base({ scans: [scan('1', { ct_date: d(-1), scanned: true, disk_collected: true })] }))).toEqual([])
  })
  it('CT today: today only if not scanned yet; scanned with the plan missing is still listed (this week)', () => {
    expect(keys(base({ scans: [scan('1', { ct_date: d(0) })] }), 'today')).toEqual(['s1'])
    expect(allKeys(base({ scans: [scan('1', { ct_date: d(0), scanned: true, disk_collected: true })] }))).toEqual([])
    const j = base({ scans: [scan('1', { ct_date: d(0), scanned: true, disk_collected: true, plan_ready: false })] })
    expect(allKeys(j)).toEqual(['today:s1'])
    expect(group(j, 'today')[0].sub).toContain('תוכנית לא מוכנה')
  })
  it('a CT within the week that misses something', () => {
    const i = base({ scans: [scan('1', { ct_date: d(3) })] })
    expect(allKeys(i)).toEqual(['soon:s1'])
    expect(group(i, 'soon')[0].sub).toContain('CT בעוד 3 ימים — CT טרם בוצע')
  })
  it('a CT in 8 days is not listed', () => expect(allKeys(base({ scans: [scan('1', { ct_date: d(8) })] }))).toEqual([]))
  it('a surgery within the week with no CT / no disk is listed; with everything ready it is not', () => {
    expect(keys(base({ scans: [scan('1', { surgery_date: d(1) })] }), 'soon')).toEqual(['s1'])
    expect(keys(base({ scans: [scan('1', { surgery_date: d(7), ct_date: d(-5), scanned: true })] }), 'soon')).toEqual(['s1'])
    expect(allKeys(base({ scans: [scan('1', { surgery_date: d(3), ct_date: d(-5), scanned: true, disk_collected: true })] }))).toEqual([])
    expect(allKeys(base({ scans: [scan('1', { surgery_date: d(8) })] }))).toEqual([])
  })
  it('the chip of a surgery in 2 days says "בעוד יומיים"', () => {
    expect(group(base({ scans: [scan('1', { surgery_date: d(2) })] }), 'soon')[0].sub).toContain('ניתוח בעוד יומיים — אין תאריך CT')
  })
  it('a past surgery with all done is not listed', () => expect(allKeys(base({ scans: [scan('1', { surgery_date: d(-1), ct_date: d(-5), scanned: true, disk_collected: true })] }))).toEqual([]))
  it('cancelled scans are ignored everywhere', () => {
    const i = base({ scans: [scan('1', { status: 'cancelled', ct_date: d(-3), surgery_date: d(0), rescan: true, rescan_date: d(-1) })] })
    expect(buildNow(i)).toEqual([])
  })
  it('re-scan: overdue is late, today is today, within a week is this week, done / far / no date are nothing', () => {
    const i = base({
      scans: [
        scan('o', { rescan: true, rescan_date: d(-2), ct_date: d(-30), scanned: true, disk_collected: true }),
        scan('t', { rescan: true, rescan_date: d(0), ct_date: d(-30), scanned: true, disk_collected: true }),
        scan('s', { rescan: true, rescan_date: d(1), ct_date: d(-30), scanned: true, disk_collected: true }),
        scan('f', { rescan: true, rescan_date: d(8), ct_date: d(-30), scanned: true, disk_collected: true }),
        scan('x', { rescan: true, rescan_date: d(-2), rescan_done: true, ct_date: d(-30), scanned: true, disk_collected: true }),
        scan('n', { rescan: true, rescan_date: null, ct_date: d(-30), scanned: true, disk_collected: true }),
      ],
    })
    expect(keys(i, 'late')).toEqual(['so'])
    expect(keys(i, 'today')).toEqual(['st'])
    expect(keys(i, 'soon')).toEqual(['ss'])
    expect(group(i, 'soon')[0].sub).toContain('סריקה חוזרת מחר')
  })
  it('every scan appears at most once on the page, whatever its dates', () => {
    const dates = [-3, -1, 0, 1, 3, 7, 8, null]
    const scans: unknown[] = []
    let n = 0
    for (const c of dates) for (const s of dates) for (const r of [null, -1, 0, 2]) {
      scans.push(scan(String(n++), { ct_date: c === null ? null : d(c), surgery_date: s === null ? null : d(s), rescan: r !== null, rescan_date: r === null ? null : d(r), scanned: n % 2 === 0, disk_collected: n % 3 === 0 }))
    }
    const all = allKeys(base({ scans: scans as never }))
    expect(new Set(all.map((k) => k.split(':')[1])).size).toBe(all.length)
  })
  it('the patient name is shown, a missing one is "מטופל"; the procedure is in Hebrew', () => {
    const it = group(base({ scans: [scan('1', { patient_name: '', ct_date: d(-1), procedure_type: 'hip' })] }), 'late')[0]
    expect(it.title).toBe('מטופל · ירך')
    expect(it.to).toBe('/scans')
  })
  it('late scans: the oldest CT first', () => {
    const i = base({ scans: [scan('a', { ct_date: d(-1) }), scan('b', { ct_date: d(-9) })] })
    expect(keys(i, 'late')).toEqual(['sb', 'sa'])
  })
  it('a task, a meeting and a scan of the same day are all there, tasks and meetings first by time', () => {
    const i = base({ tasks: [task('a', d(0))], meetings: [meeting('m', d(0))], scans: [scan('s', { ct_date: d(0) })] })
    expect(keys(i, 'today')).toEqual(['mm', 'ta', 'ss'])
  })
})

describe('doctors to call back', () => {
  const cad = (id: string, cadence: number, extra: Record<string, unknown> = {}) => doctor(id, { contact_cadence_days: cadence, ...extra })
  const met = (docId: string, date: string, status = 'done') => meeting(`m-${docId}-${date}`, date, { status, meeting_doctors: [{ doctor: { id: docId } }] })
  it('only favourites with a cadence; overdue and due within 7 days', () => {
    const i = base({
      favorites: ['a', 'b', 'c', 'd', 'e'],
      doctors: [cad('a', 30), cad('b', 30), cad('c', 30), cad('d', 30), doctor('e'), cad('f', 30)],
      meetings: [met('a', d(-40)), met('b', d(-25)), met('c', d(-10)), met('d', d(-23)), met('f', d(-90))],
    })
    // a: due -10 days ago · b: due in 5 · c: due in 20 (fine) · d: due in 7 (soon, the boundary) · e: no cadence · f: not a favourite
    expect(keys(i, 'contact')).toEqual(['ca', 'cb', 'cd'])
  })
  it('the most overdue first, then the nearest', () => {
    const i = base({ favorites: ['a', 'b', 'c'], doctors: [cad('a', 30), cad('b', 30), cad('c', 30)], meetings: [met('a', d(-35)), met('b', d(-50)), met('c', d(-27))] })
    expect(keys(i, 'contact')).toEqual(['cb', 'ca', 'cc'])
  })
  it('the wording: overdue by N days / in N days (singular and dual forms)', () => {
    const i = base({ favorites: ['a', 'b', 'c', 'd'], doctors: [cad('a', 30), cad('b', 30), cad('c', 30), cad('d', 30)], meetings: [met('a', d(-31)), met('b', d(-32)), met('c', d(-34)), met('d', d(-28))] })
    const w = Object.fromEntries(group(i, 'contact').map((x) => [x.key, x.when]))
    expect(w).toEqual({ ca: 'באיחור של יום', cb: 'באיחור של יומיים', cc: 'באיחור של 4 ימים', cd: 'בעוד יומיים' })
  })
  it('a booked meeting covers the cadence', () => {
    const i = base({ favorites: ['a'], doctors: [cad('a', 30)], meetings: [met('a', d(-60)), meeting('n', d(3), { meeting_doctors: [{ doctor: { id: 'a' } }] })] })
    expect(keys(i, 'contact')).toEqual([])
  })
  it('never met: counted from the day the doctor was added, "אין פגישה מתועדת"', () => {
    const i = base({ favorites: ['a'], doctors: [cad('a', 14, { created_at: `${d(-20)}T08:00:00Z` })] })
    expect(group(i, 'contact')[0].sub).toBe('אין פגישה מתועדת')
    expect(group(i, 'contact')[0].when).toBe('באיחור של 6 ימים')
  })
  it('a closed ("lost") favourite is not chased', () => {
    const i = base({ favorites: ['a'], doctors: [cad('a', 30, { status: 'lost' })], meetings: [met('a', d(-60))] })
    expect(keys(i, 'contact')).toEqual([])
  })
  it('the title has no leading space when the doctor has no title', () => {
    const i = base({ favorites: ['a'], doctors: [cad('a', 30, { title: '', name: 'אלי' })], meetings: [met('a', d(-60))] })
    expect(group(i, 'contact')[0].title).toBe('אלי')
    expect(group(i, 'contact')[0].to).toBe('/doctors/a')
  })
})

describe('competitor opportunities', () => {
  const list = [
    intel('c-soon', { contract_end: d(10) }),
    intel('c-today', { contract_end: d(0) }),
    intel('c-yest', { contract_end: d(-1) }),
    intel('c-60', { contract_end: d(60) }),
    intel('c-61', { contract_end: d(61) }),
    intel('t-soon', { tender_due: d(5), tender_name: 'מכרז ברך', hospital_id: 'h2', hospital: { id: 'h2', name: 'איכילוב' } }),
    intel('won', { contract_end: d(5), outcome: 'won' }),
    intel('lost', { contract_end: d(6), outcome: 'lost' }),
    intel('nohosp', { contract_end: d(20), hospital_id: null, hospital: null }),
  ]
  it('a manager sees all, ordered by date; 60 days is in, 61 is out, a past date is out, "won" is out', () => {
    expect(keys(base({ isAdmin: true, intel: list }), 'competitors')).toEqual(['kcc-today', 'ktt-soon', 'kclost', 'kcc-soon', 'kcnohosp', 'kcc-60'])
  })
  it('an agent sees his hospitals and records with no hospital', () => {
    const ids = keys(base({ myHospitals: ['h1'], intel: list }), 'competitors')
    expect(ids).not.toContain('ktt-soon')
    expect(ids).toContain('kcc-soon')
    expect(ids).toContain('kcnohosp')
  })
  it('an agent with no hospitals sees everything (a manager has not assigned him yet)', () => {
    expect(keys(base({ myHospitals: [], intel: list }), 'competitors')).toContain('ktt-soon')
  })
  it('an agent whose hospitals are not known yet sees no opportunities (no flash of other hospitals)', () => {
    expect(group(base({ myHospitals: null, intel: list }), 'competitors')).toEqual([])
  })
  it('the wording of the days: today, tomorrow, the day after, N days', () => {
    const j = base({ isAdmin: true, intel: [intel('a', { contract_end: d(0) }), intel('b', { contract_end: d(1) }), intel('c', { contract_end: d(2) }), intel('e', { contract_end: d(9) })] })
    expect(group(j, 'competitors').map((x) => x.when)).toEqual(['היום', 'מחר', 'בעוד יומיים', 'בעוד 9 ימים'])
  })
  it('titles: contract end / tender (with and without a name)', () => {
    const j = base({ isAdmin: true, intel: [intel('a', { contract_end: d(1), competitor: 'Zimmer' }), intel('b', { tender_due: d(2), tender_name: 'מכרז X' }), intel('c', { tender_due: d(3), tender_name: '' })] })
    expect(group(j, 'competitors').map((x) => x.title)).toEqual(['סיום חוזה · Zimmer', 'מכרז מכרז X · Stryker', 'מכרז · Stryker'])
  })
  it('one record with both a contract end and a tender gives two rows with different keys', () => {
    const j = base({ isAdmin: true, intel: [intel('a', { contract_end: d(4), tender_due: d(5) })] })
    expect(keys(j, 'competitors')).toEqual(['kca', 'kta'])
  })
  it('new activity: the last 7 days, by somebody else, at my hospitals; at most 5; newest first', () => {
    const rows = Array.from({ length: 8 }, (_, n) => intel(`n${n}`, { created_at: ts(-n * 0.5), created_by: 'other' }))
    const j = base({ isAdmin: true, intel: [...rows, intel('mine', { created_at: ts(-1), created_by: 'me' }), intel('old', { created_at: ts(-8) })] })
    expect(keys(j, 'competitors')).toEqual(['nn0', 'nn1', 'nn2', 'nn3', 'nn4'])
  })
  it('new activity: the title shows the product only when there is one', () => {
    const j = base({ isAdmin: true, intel: [intel('a', { product: 'Mako', created_at: ts(-1) }), intel('b', { created_at: ts(-1) })] })
    expect(group(j, 'competitors').map((x) => x.title)).toEqual(['פעילות חדשה של Stryker (Mako)', 'פעילות חדשה של Stryker'])
  })
  it('a new record that is already an alert is not repeated as activity', () => {
    const j = base({ isAdmin: true, intel: [intel('a', { contract_end: d(5), created_at: ts(-1) })] })
    expect(keys(j, 'competitors')).toEqual(['kca'])
  })
  it('new activity at a hospital that is not mine is hidden from the agent', () => {
    const j = base({ myHospitals: ['h2'], intel: [intel('a')] })
    expect(group(j, 'competitors')).toEqual([])
  })
  it('competitorAlerts at the month boundary', () => {
    vi.setSystemTime(new Date(2026, 11, 20, 12))
    const a = competitorAlerts([intel('a', { contract_end: '2027-01-18' }), intel('b', { contract_end: '2027-01-20' })], null, 30)
    expect(a.map((x) => x.intel.id)).toEqual(['a'])
    expect(a[0].days).toBe(29)
  })
  it('newActivity without a user id counts everything', () => {
    expect(newActivity([intel('a', { created_by: 'me', created_at: ts(-1) })], null, undefined).length).toBe(1)
  })
})

describe('potential doctors that need a push', () => {
  const pot = (id: string, o: Record<string, unknown> = {}) => doctor(id, { status: 'potential', pipeline_stage: 'יצירת קשר', next_step: 'לקבוע', next_step_date: d(3), ...o })
  it('lists a late next step, a missing stage, a missing next step, and too long in a stage', () => {
    const i = base({
      isAdmin: true,
      doctors: [pot('ok'), pot('late', { next_step_date: d(-4) }), pot('nostage', { pipeline_stage: '' }), pot('nostep', { next_step: '', next_step_date: null }), pot('long')],
      stageHistory: [{ doctor_id: 'long', stage: 'יצירת קשר', previous_stage: '', changed_at: `${d(-45)}T09:00:00Z` }],
    })
    expect(keys(i, 'pipeline').sort()).toEqual(['plate', 'plong', 'pnostage', 'pnostep'])
    expect(group(i, 'pipeline').find((x) => x.key === 'plate')?.sub).toContain('הצעד הבא באיחור 4 ימים')
    expect(group(i, 'pipeline').find((x) => x.key === 'plong')?.sub).toContain('45 ימים באותו שלב')
  })
  it('clients and closed doctors are never listed', () => {
    const i = base({ isAdmin: true, doctors: [doctor('c', { status: 'client' }), doctor('l', { status: 'lost' })] })
    expect(group(i, 'pipeline')).toEqual([])
  })
  it('the exact threshold: 30 days is not stuck, 31 is', () => {
    const h = (n: number) => [{ doctor_id: 'a', stage: 'יצירת קשר', previous_stage: '', changed_at: `${d(-n)}T09:00:00Z` }]
    expect(group(base({ isAdmin: true, doctors: [pot('a')], stageHistory: h(30) }), 'pipeline')).toEqual([])
    expect(keys(base({ isAdmin: true, doctors: [pot('a')], stageHistory: h(31) }), 'pipeline')).toEqual(['pa'])
  })
  it('an agent sees the ones he created or at his hospitals; a manager sees all', () => {
    const docs = [
      pot('mine', { created_by: 'me', next_step_date: d(-1) }),
      pot('hosp', { next_step_date: d(-1), doctor_hospitals: [{ hospital_id: 'h1' }] }),
      pot('other', { next_step_date: d(-1), doctor_hospitals: [{ hospital_id: 'h9' }] }),
    ]
    expect(keys(base({ myHospitals: ['h1'], doctors: docs }), 'pipeline').sort()).toEqual(['phosp', 'pmine'])
    expect(keys(base({ myHospitals: null, doctors: docs }), 'pipeline')).toEqual(['pmine'])
    expect(keys(base({ isAdmin: true, doctors: docs }), 'pipeline').sort()).toEqual(['phosp', 'pmine', 'pother'])
  })
  it('a doctor without a stage is shown as "ללא שלב"', () => {
    const it = group(base({ isAdmin: true, doctors: [pot('a', { pipeline_stage: '' })] }), 'pipeline')[0]
    expect(it.sub.startsWith('ללא שלב')).toBe(true)
  })
})

describe('managers: backup, large files, procedures, suggestions', () => {
  const up = (id: string, o: Record<string, unknown> = {}) => ({ id, requested_by: 'u1', file_name: `f${id}.zip`, file_size: 30 * 1024 * 1024, purpose: 'CT', status: 'pending', decided_at: null, decision_note: '', created_at: ts(-1), requester: { full_name: 'דנה' }, ...o }) as never
  it('backup: never, old, recent, unknown', () => {
    expect(group(base({ isAdmin: true, lastBackup: '' }), 'backup')[0].title).toBe('עוד לא נעשה גיבוי של הנתונים')
    expect(group(base({ isAdmin: true, lastBackup: `${d(-8)}T10:00:00Z` }), 'backup')[0].title).toBe('הגיבוי האחרון לפני 8 ימים')
    expect(group(base({ isAdmin: true, lastBackup: `${d(-7)}T10:00:00Z` }), 'backup')).toEqual([])
    expect(group(base({ isAdmin: true, lastBackup: undefined }), 'backup')).toEqual([])
    expect(group(base({ isAdmin: false, lastBackup: '' }), 'backup')).toEqual([])
  })
  it('backup: a timestamp just after local midnight counts as that local day', () => {
    // 00:30 on the 12th in Israel (UTC+3 in October) is still the 11th in UTC
    const local = new Date(2026, 9, 12, 0, 30).toISOString()
    expect(group(base({ isAdmin: true, lastBackup: local }), 'backup')[0].title).toBe('הגיבוי האחרון לפני 8 ימים')
  })
  it('uploads: managers see the pending ones; others never do', () => {
    const list = [up('1'), up('2', { status: 'approved' })]
    expect(keys(base({ isAdmin: true, userId: 'boss', uploads: list }), 'uploads')).toEqual(['u1'])
    expect(keys(base({ userId: 'boss', uploads: list }), 'uploads')).toEqual([])
    expect(group(base({ isAdmin: true, userId: 'boss', uploads: list }), 'uploads')[0].sub).toBe('30MB · CT · דנה')
  })
  it('uploads: my approved request, and my rejected one for 7 days; neither links to this same page', () => {
    const list = [up('1', { status: 'approved', requested_by: 'me' }), up('2', { status: 'rejected', requested_by: 'me', decided_at: ts(-3), decision_note: 'גדול' }), up('3', { status: 'rejected', requested_by: 'me', decided_at: ts(-9) }), up('4', { status: 'approved', requested_by: 'other' })]
    const g = group(base({ uploads: list }), 'uploads')
    expect(g.map((x) => x.key)).toEqual(['ua1', 'ur2'])
    expect(g.every((x) => x.to === null)).toBe(true)
  })
  it('procedures: pending for managers, answers for the requester for a week', () => {
    const pr = (id: string, o: Record<string, unknown> = {}) => ({ id, requested_by: 'me', name: `הליך ${id}`, parent: null, note: '', status: 'pending', decided_at: null, decision_note: '', created_at: ts(-1), requester: { full_name: 'דנה' }, ...o }) as never
    const list = [pr('1'), pr('2', { status: 'approved', decided_at: ts(-2) }), pr('3', { status: 'rejected', decided_at: ts(-8) }), pr('4', { status: 'rejected', decided_at: ts(-1), requested_by: 'x' })]
    expect(keys(base({ procRequests: list }), 'procedures')).toEqual(['pa2'])
    expect(keys(base({ isAdmin: true, procRequests: list }), 'procedures')).toEqual(['pq1', 'pa2'])
    expect(group(base({ procRequests: list }), 'procedures')[0].title).toBe('ההליך "הליך 2" אושר ונוסף לרשימה')
  })
  it('suggestions: new ones for the developer (long text cut), answers to my own for 2 weeks', () => {
    const sg = (id: string, o: Record<string, unknown> = {}) => ({ id, created_by: 'me', kind: 'idea', body: 'רעיון', page: '/now', status: 'new', dev_note: '', handled_at: null, created_at: ts(-1), author: { full_name: 'דנה', email: '' }, ...o }) as never
    const list = [sg('1', { body: 'א'.repeat(100) }), sg('2', { status: 'done', handled_at: ts(-13), dev_note: 'בוצע' }), sg('3', { status: 'declined', handled_at: ts(-15) }), sg('4', { created_by: 'x', status: 'done', handled_at: ts(-1) })]
    expect(keys(base({ suggestions: list }), 'suggestions')).toEqual(['sa2'])
    const dev = group(base({ isDeveloper: true, suggestions: list }), 'suggestions')
    expect(dev.map((x) => x.key)).toEqual(['sg1', 'sa2'])
    expect(dev[0].title).toBe(`רעיון לשיפור: ${'א'.repeat(80)}…`)
  })
})

describe('page order and duplicates', () => {
  it('groups come in the fixed order of urgency', () => {
    const i = base({
      isAdmin: true,
      lastBackup: '',
      tasks: [task('a', d(-1)), task('b', d(0)), task('c', d(2))],
      favorites: ['x'],
      doctors: [doctor('x', { contact_cadence_days: 30 })],
      intel: [intel('k', { contract_end: d(3) })],
    })
    expect(buildNow(i).map((g) => g.id)).toEqual(['late', 'today', 'soon', 'contact', 'backup', 'competitors'])
  })
  it('no key repeats inside a group, over a big mixed list', () => {
    const tasks = Array.from({ length: 200 }, (_, n) => task(String(n), d((n % 15) - 5)))
    const scans = Array.from({ length: 150 }, (_, n) => scan(String(n), { ct_date: d((n % 13) - 5), surgery_date: d((n % 11) - 2) }))
    const meetings = Array.from({ length: 150 }, (_, n) => meeting(String(n), d((n % 17) - 6)))
    const g = buildNow(base({ tasks, scans, meetings }))
    for (const grp of g) expect(new Set(grp.items.map((x) => x.key)).size).toBe(grp.items.length)
  })
  it('500 items are built fast', () => {
    const tasks = Array.from({ length: 500 }, (_, n) => task(String(n), d((n % 20) - 8)))
    const docs = Array.from({ length: 500 }, (_, n) => doctor(String(n), { contact_cadence_days: 30 }))
    const t0 = performance.now()
    buildNow(base({ tasks, doctors: docs, favorites: docs.map((x) => (x as unknown as { id: string }).id) }))
    expect(performance.now() - t0).toBeLessThan(500)
  })
})
