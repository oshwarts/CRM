import { describe, expect, it } from 'vitest'
import { buildItems, countKinds, plannedItems, visibleItems } from '../lib/scheduleItems'
import { iso, nextHalfHour, parseISO, rangeFor, shiftAnchor, titleFor } from '../lib/calendar'
import type { PlannedSurgery } from '../lib/plannedSurgeries'
import type { Kind } from '../components/schedule/shared'

const ps = (id: string, p: Partial<PlannedSurgery> = {}): PlannedSurgery => ({
  id, surgery_date: '2026-10-22', surgery_time: null, doctor_id: 'd1', hospital_id: 'h1', procedure: 'ברך', company: '', notes: '', cases: 1,
  agent_id: 'a1', status: 'planned', created_by: 'a1',
  doctor: { id: 'd1', title: 'ד״ר', name: 'כהן' }, hospital: { id: 'h1', name: 'שיבא' }, agent: { id: 'a1', full_name: 'דנה' }, ...p,
})
const scan = (id: string, p: Record<string, unknown> = {}) => ({
  id, patient_name: `מטופל ${id}`, status: 'planned', surgery_date: '2026-10-22', ct_date: null, ct_time: null, scanned: false, rescan: false, rescan_done: false,
  rescan_date: null, rescan_reason: '', procedure_type: 'knee', side: '', surgeon_id: 'd1', hospital_id: 'h1',
  surgeon: { id: 'd1', title: 'ד״ר', name: 'כהן' }, hospital: { id: 'h1', name: 'שיבא' }, ...p,
})
const all: Record<Kind, boolean> = { meeting: true, surgery: true, ct: true, rescan: true, followup: true, task: true }
const src = (o: Record<string, unknown>) => buildItems({ meetings: [], scans: [], planned: [], tasks: [], agentsOfHospital: new Map(), ...o } as never)

describe('surgeries entered by hand add up', () => {
  it('the same surgeon, hospital, day and type are one line with the cases summed and the earliest hour', () => {
    const out = plannedItems([ps('1', { cases: 2, surgery_time: '09:30:00' }), ps('2', { cases: 3, surgery_time: '07:45:00' }), ps('3', { cases: 1 })])
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('6 × ברך')
    expect(out[0].time).toBe('07:45')
    expect(out[0].group).toHaveLength(3)
    expect(out[0].id).toBe('p-1')
  })
  it('a different surgeon, hospital, day or type stays a separate line', () => {
    const out = plannedItems([
      ps('1'),
      ps('2', { doctor_id: 'd2' }),
      ps('3', { hospital_id: 'h2' }),
      ps('4', { surgery_date: '2026-10-23' }),
      ps('5', { procedure: 'ירך' }),
    ])
    expect(out).toHaveLength(5)
  })
  it('the type ignores case and surrounding spaces, an empty type is called "ניתוח"', () => {
    const out = plannedItems([ps('1', { procedure: 'Knee ' }), ps('2', { procedure: ' knee' }), ps('3', { procedure: '', doctor_id: null, hospital_id: null, doctor: null, hospital: null })])
    expect(out).toHaveLength(2)
    expect(out[0].title).toBe('2 × Knee')
    expect(out[1].title).toBe('ניתוח')
  })
  it('cancelled rows are left out, a line is muted only when every row is done, the company and notes show', () => {
    expect(plannedItems([ps('1', { status: 'cancelled' })])).toHaveLength(0)
    expect(plannedItems([ps('1', { status: 'done' }), ps('2', { status: 'planned' })])[0].muted).toBe(false)
    const done = plannedItems([ps('1', { status: 'done' }), ps('2', { status: 'done' })])[0]
    expect(done.muted).toBe(true)
    const one = plannedItems([ps('1', { company: 'Zimmer', notes: 'חדר 3' }), ps('2', { notes: 'חדר 3' })])[0]
    expect(one.title).toBe('2 × ברך · Zimmer')
    expect(one.sub).toBe('שיבא · ד״ר כהן · חדר 3')
  })
  it('a line belongs to every agent of its rows', () => {
    const out = plannedItems([ps('1', { agent_id: 'a1' }), ps('2', { agent_id: 'a2' }), ps('3', { agent_id: null })])
    expect(out[0].agentIds).toEqual(['a1', 'a2'])
  })
  it('a row without cases counts as one', () => {
    expect(plannedItems([ps('1', { cases: undefined as never }), ps('2')])[0].title).toBe('2 × ברך')
  })
})

describe('MAKO scans on the calendar', () => {
  it('surgeries of the same surgeon, hospital, day and type are one line; a single one names the patient', () => {
    const two = src({ scans: [scan('1'), scan('2')] }).filter((i) => i.kind === 'surgery')
    expect(two).toHaveLength(1)
    expect(two[0].title).toBe('2 × ברך MAKO')
    const one = src({ scans: [scan('1', { side: 'ימין' })] }).filter((i) => i.kind === 'surgery')
    expect(one[0].title).toBe('ברך MAKO ימין – מטופל 1')
    expect(src({ scans: [scan('1'), scan('2', { procedure_type: 'hip' })] }).filter((i) => i.kind === 'surgery')).toHaveLength(2)
  })
  it('cancelled scans are left out, CT and rescan get their own line, a done rescan does not', () => {
    const items = src({
      scans: [
        scan('1', { status: 'cancelled', ct_date: '2026-10-20' }),
        scan('2', { surgery_date: null, ct_date: '2026-10-20', ct_time: '08:15:00', scanned: true, rescan: true, rescan_date: '2026-10-21', rescan_reason: 'איכות' }),
        scan('3', { surgery_date: null, rescan: true, rescan_done: true, rescan_date: '2026-10-21' }),
      ],
    })
    expect(items.map((i) => i.kind).sort()).toEqual(['ct', 'rescan'])
    const ct = items.find((i) => i.kind === 'ct')!
    expect(ct.time).toBe('08:15')
    expect(ct.muted).toBe(true)
  })
  it('the agents of a scan are the agents of its hospital', () => {
    const items = src({ scans: [scan('1')], agentsOfHospital: new Map([['h1', ['a1', 'a2']]]) })
    expect(items[0].agentIds).toEqual(['a1', 'a2'])
  })
  it('a line is muted when all its surgeries are done', () => {
    expect(src({ scans: [scan('1', { status: 'done' }), scan('2', { status: 'done' })] })[0].muted).toBe(true)
    expect(src({ scans: [scan('1', { status: 'done' }), scan('2')] })[0].muted).toBe(false)
  })
})

describe('meetings and tasks', () => {
  const meeting = (p: Record<string, unknown> = {}) => ({
    id: 'm1', subject: 'הדגמה', status: 'scheduled', meeting_date: '2026-10-22', meeting_time: '10:00:00', next_followup_date: '2026-10-29', hospital: { id: 'h1', name: 'שיבא' },
    meeting_doctors: [{ doctor: { title: 'ד״ר', name: 'כהן' } }], meeting_contacts: [{ contact: { name: 'רוני' } }], responsible_agent_id: 'a1', meeting_agents: [{ agent: { id: 'a2' } }], ...p,
  })
  it('a meeting and its follow-up are two lines; cancelled ones vanish; a done meeting is muted and has no follow-up', () => {
    const items = src({ meetings: [meeting()] })
    expect(items.map((i) => [i.kind, i.date, i.time])).toEqual([['meeting', '2026-10-22', '10:00'], ['followup', '2026-10-29', '']])
    expect(items[0].sub).toBe('שיבא · ד״ר כהן, רוני')
    expect(items[0].agentIds).toEqual(['a1', 'a2'])
    expect(src({ meetings: [meeting({ status: 'cancelled' })] })).toHaveLength(0)
    const done = src({ meetings: [meeting({ status: 'done' })] })
    expect(done).toHaveLength(1)
    expect(done[0].muted).toBe(true)
  })
  it('a meeting without a subject is called "פגישה"; one without a date only has its follow-up', () => {
    expect(src({ meetings: [meeting({ subject: '' })] })[0].title).toBe('פגישה')
    expect(src({ meetings: [meeting({ meeting_date: null })] }).map((i) => i.kind)).toEqual(['followup'])
  })
  it('only open tasks with a due date appear, for their assignee', () => {
    const t = (id: string, p: Record<string, unknown> = {}) => ({ id, description: id, is_done: false, due_date: '2026-10-22', assignee_id: 'a1', doctor: null, hospital: null, ...p })
    const items = src({ tasks: [t('x'), t('done', { is_done: true }), t('nodate', { due_date: null })] })
    expect(items.map((i) => i.title)).toEqual(['x'])
    expect(items[0].agentIds).toEqual(['a1'])
  })
})

describe('what the screen shows', () => {
  const items = src({
    planned: [ps('1', { surgery_date: '2026-10-18', surgery_time: '12:00:00' }), ps('2', { surgery_date: '2026-10-18', doctor_id: 'd2', surgery_time: '08:00:00', agent_id: 'a2' }), ps('3', { surgery_date: '2026-10-25' }), ps('4', { surgery_date: '2026-10-24', doctor_id: 'd3', procedure: 'x' })],
    tasks: [{ id: 't', description: 't', is_done: false, due_date: '2026-10-18', assignee_id: 'a1', doctor: null, hospital: null }],
  } as never)
  it('only the days of the range, both ends included, ordered by day, hour (none last) and kind', () => {
    const v = visibleItems(items, '2026-10-18', '2026-10-24', all, '')
    expect(v.map((i) => i.id)).toEqual(['p-2', 'p-1', 't-t', 'p-4'])
  })
  it('the kinds switched off disappear, the agent filter keeps only that agent, clearing it brings everything back', () => {
    expect(visibleItems(items, '2026-10-18', '2026-10-24', { ...all, task: false }, '').map((i) => i.id)).toEqual(['p-2', 'p-1', 'p-4'])
    expect(visibleItems(items, '2026-10-18', '2026-10-24', all, 'a2').map((i) => i.id)).toEqual(['p-2'])
    expect(visibleItems(items, '2026-10-18', '2026-10-24', all, '')).toHaveLength(4)
  })
  it('the counts on the chips follow the range and the agent, not the switches', () => {
    expect(countKinds(items, '2026-10-18', '2026-10-24', '')).toEqual({ meeting: 0, surgery: 3, ct: 0, rescan: 0, followup: 0, task: 1 })
    expect(countKinds(items, '2026-10-18', '2026-10-24', 'a1')).toEqual({ meeting: 0, surgery: 2, ct: 0, rescan: 0, followup: 0, task: 1 })
    expect(countKinds([], '2026-10-18', '2026-10-24', '')).toEqual({ meeting: 0, surgery: 0, ct: 0, rescan: 0, followup: 0, task: 0 })
  })
})

describe('week maths', () => {
  const week = (d: string) => rangeFor('week', parseISO(d)).days.map(iso)
  it('a Sunday starts the week and a Saturday ends it', () => {
    expect(week('2026-10-18')[0]).toBe('2026-10-18')
    expect(week('2026-10-24')[0]).toBe('2026-10-18')
    expect(week('2026-10-24')[6]).toBe('2026-10-24')
  })
  it('a week across the new year', () => {
    expect(week('2026-12-31')).toEqual(['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    expect(titleFor('week', parseISO('2026-12-31'))).toBe('27/12 – 02/01/2027')
    expect(iso(shiftAnchor('week', parseISO('2026-12-31'), 1))).toBe('2027-01-07')
  })
  it('weeks around the end of summer time (25/10/2026) and its start (27/03/2026) keep seven distinct days', () => {
    for (const d of ['2026-10-25', '2026-10-24', '2026-10-31', '2026-03-27', '2026-03-29']) {
      const days = week(d)
      expect(new Set(days).size).toBe(7)
      expect(parseISO(days[0]).getDay()).toBe(0)
    }
    expect(week('2026-10-25')[0]).toBe('2026-10-25')
    expect(iso(shiftAnchor('week', parseISO('2026-10-18'), 1))).toBe('2026-10-25')
    expect(iso(shiftAnchor('week', parseISO('2026-10-25'), 1))).toBe('2026-11-01')
    expect(iso(shiftAnchor('day', parseISO('2026-10-24'), 1))).toBe('2026-10-25')
    expect(iso(shiftAnchor('day', parseISO('2026-10-25'), 1))).toBe('2026-10-26')
  })
  it('a leap-year February and a month that needs six weeks', () => {
    expect(rangeFor('month', parseISO('2028-02-10')).days.map(iso)).toContain('2028-02-29')
    expect(rangeFor('month', parseISO('2026-11-10')).days).toHaveLength(35) // 1 Nov 2026 is a Sunday, 30 Nov a Monday
    expect(rangeFor('month', parseISO('2027-05-10')).days).toHaveLength(42) // 1 May 2027 is a Saturday, 31 May a Monday
    expect(iso(shiftAnchor('month', parseISO('2026-12-15'), 1))).toBe('2027-01-15')
    expect(iso(shiftAnchor('month', parseISO('2027-01-15'), -1))).toBe('2026-12-15')
  })
  it('the next half hour', () => {
    const at = (h: number, m: number) => nextHalfHour(new Date(2026, 9, 22, h, m))
    expect(at(14, 12)).toBe('14:30')
    expect(at(14, 29)).toBe('14:30')
    expect(at(14, 30)).toBe('15:00')
    expect(at(0, 0)).toBe('00:30')
    expect(at(23, 29)).toBe('23:30')
    expect(at(23, 45)).toBe('23:30')
  })
})
