import { describe, expect, it } from 'vitest'
import { assignmentChangeMessage, assignmentConflicts, assignmentShort, availabilityLine, availabilityToCopy, assignmentsToCopy, coverageGaps, dayAvailability, fillableShift, groupByHospital, overloaded, shiftLine, suggestionsFor, teamLoad, unreportedShifts, weekDates, weekStartOf } from '../lib/roster'

describe('weekDates', () => {
  it('returns Sunday through Saturday of the week holding the anchor', () => {
    // 2026-10-27 is a Tuesday
    expect(weekDates('2026-10-27')).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'])
  })
  it('a Sunday anchor starts on itself', () => {
    expect(weekDates('2026-10-25')[0]).toBe('2026-10-25')
  })
})

describe('dayAvailability / availabilityLine', () => {
  it('no rows at all: not reported', () => {
    expect(dayAvailability([])).toBe('unset')
    expect(availabilityLine([])).toBe('לא דווח')
  })
  it('both shifts available: the whole day', () => {
    const rows = [{ shift: 'morning' as const, status: 'available' as const }, { shift: 'evening' as const, status: 'available' as const }]
    expect(dayAvailability(rows)).toBe('full')
  })
  it('only the morning shift available', () => {
    expect(dayAvailability([{ shift: 'morning' as const, status: 'available' as const }])).toBe('morning')
  })
  it('both shifts unavailable, with the reason shown once', () => {
    const rows = [
      { shift: 'morning' as const, status: 'unavailable' as const, reason: 'חופשה' },
      { shift: 'evening' as const, status: 'unavailable' as const, reason: 'חופשה' },
    ]
    expect(dayAvailability(rows)).toBe('none')
    expect(availabilityLine(rows)).toBe('לא זמין — חופשה')
  })
})

describe('teamLoad / overloaded', () => {
  it('counts only field-work shifts, per agent', () => {
    const rows = [
      { agent_id: 'a', work_type: 'field' as const },
      { agent_id: 'a', work_type: 'field' as const },
      { agent_id: 'a', work_type: 'office' as const },
      { agent_id: 'b', work_type: 'field' as const },
    ]
    const load = teamLoad(rows, ['a', 'b', 'c'])
    expect(load.get('a')).toBe(2)
    expect(load.get('b')).toBe(1)
    expect(load.get('c')).toBe(0)
  })
  it('flags only someone clearly above the team average', () => {
    const load = new Map([['a', 6], ['b', 1], ['c', 2]])
    expect(overloaded(load)).toEqual(new Set(['a']))
  })
  it('does not flag anyone when the team is close together', () => {
    const load = new Map([['a', 3], ['b', 2], ['c', 3]])
    expect(overloaded(load)).toEqual(new Set())
  })
  it('one agent alone is never "above average"', () => {
    expect(overloaded(new Map([['a', 9]]))).toEqual(new Set())
  })
})

describe('suggestionsFor', () => {
  const agentId = 'ag1'
  const date = '2026-10-27'
  const h1 = { id: 'h1', name: 'שיבא' }
  const h2 = { id: 'h2', name: 'איכילוב' }

  it('a task due that day outweighs one that is merely overdue', () => {
    const r = suggestionsFor({
      agentId,
      date,
      tasks: [
        { assignee_id: agentId, due_date: date, is_done: false, hospital_id: h1.id, hospital_name: h1.name, priority: 'normal', description: 'מעקב' },
        { assignee_id: agentId, due_date: '2026-10-20', is_done: false, hospital_id: h2.id, hospital_name: h2.name, priority: 'normal', description: 'ישן' },
      ],
      meetings: [],
      scans: [],
      hospitalsOfAgent: [h1, h2],
    })
    expect(r[0].hospitalId).toBe('h1')
    expect(r[0].reasons[0]).toContain('מעקב')
  })
  it('ignores a done task, another agent\'s task, and one with no due date', () => {
    const r = suggestionsFor({
      agentId,
      date,
      tasks: [
        { assignee_id: agentId, due_date: date, is_done: true, hospital_id: h1.id, hospital_name: h1.name, priority: 'normal', description: 'בוצע' },
        { assignee_id: 'other', due_date: date, is_done: false, hospital_id: h1.id, hospital_name: h1.name, priority: 'normal', description: 'של מישהו אחר' },
        { assignee_id: agentId, due_date: null, is_done: false, hospital_id: h1.id, hospital_name: h1.name, priority: 'normal', description: 'בלי תאריך' },
      ],
      meetings: [],
      scans: [],
      hospitalsOfAgent: [h1],
    })
    expect(r).toEqual([])
  })
  it('a meeting that day scores highest of all', () => {
    const r = suggestionsFor({
      agentId,
      date,
      tasks: [{ assignee_id: agentId, due_date: date, is_done: false, hospital_id: h2.id, hospital_name: h2.name, priority: 'normal', description: 'משימה' }],
      meetings: [{ meeting_date: date, status: 'planned', agent_ids: [agentId], hospital_id: h1.id, hospital_name: h1.name, subject: 'היכרות' }],
      scans: [],
      hospitalsOfAgent: [h1, h2],
    })
    expect(r[0].hospitalId).toBe('h1')
  })
  it('a cancelled meeting, or one for another agent, is not counted', () => {
    const r = suggestionsFor({
      agentId,
      date,
      tasks: [],
      meetings: [
        { meeting_date: date, status: 'cancelled', agent_ids: [agentId], hospital_id: h1.id, hospital_name: h1.name, subject: 'בוטלה' },
        { meeting_date: date, status: 'planned', agent_ids: ['other'], hospital_id: h1.id, hospital_name: h1.name, subject: 'לא שלי' },
      ],
      scans: [],
      hospitalsOfAgent: [h1],
    })
    expect(r).toEqual([])
  })
  it('an upcoming CT at a covered hospital nudges toward it, done/cancelled ones do not count', () => {
    const r = suggestionsFor({
      agentId,
      date,
      tasks: [],
      meetings: [],
      scans: [
        { hospital_id: h1.id, hospital_name: h1.name, ct_date: '2026-10-28', surgery_date: null, status: 'planned' },
        { hospital_id: h1.id, hospital_name: h1.name, ct_date: '2026-11-15', surgery_date: null, status: 'planned' }, // too far out
        { hospital_id: h1.id, hospital_name: h1.name, ct_date: '2026-10-27', surgery_date: null, status: 'done' }, // already handled
      ],
      hospitalsOfAgent: [h1],
    })
    expect(r).toHaveLength(1)
    expect(r[0].hospitalId).toBe('h1')
    expect(r[0].reasons[0]).toContain('קרוב')
  })
  it('no signals at all: no suggestion (the caller offers an office day instead)', () => {
    expect(suggestionsFor({ agentId, date, tasks: [], meetings: [], scans: [], hospitalsOfAgent: [h1] })).toEqual([])
  })
  it('caps the list at three hospitals, best first', () => {
    const hospitals = ['h1', 'h2', 'h3', 'h4'].map((id) => ({ id, name: id }))
    const tasks = hospitals.map((h, i) => ({ assignee_id: agentId, due_date: date, is_done: false, hospital_id: h.id, hospital_name: h.name, priority: i === 0 ? 'urgent' : 'normal', description: 't' }))
    const r = suggestionsFor({ agentId, date, tasks, meetings: [], scans: [], hospitalsOfAgent: hospitals })
    expect(r).toHaveLength(3)
    expect(r[0].hospitalId).toBe('h1') // the urgent one
  })
})

describe('weekStartOf', () => {
  it('matches the first day weekDates gives for the same date', () => {
    expect(weekStartOf('2026-10-27')).toBe('2026-10-25')
    expect(weekStartOf('2026-10-25')).toBe('2026-10-25')
  })
})

describe('assignmentChangeMessage', () => {
  const date = '2026-10-27'
  it('a cleared assignment', () => {
    expect(assignmentChangeMessage(date, 'morning', null)).toBe('השיבוץ שלך למשמרת בוקר 2026-10-27 בוטל')
  })
  it('an assignment at a hospital does not repeat the hospital name (the agent sees it in the list)', () => {
    const msg = assignmentChangeMessage(date, 'evening', { agent_id: 'a', date, shift: 'evening', hospital_id: 'h1', area: '', work_type: 'field', task_id: null, meeting_id: null, note: '' })
    expect(msg).toBe('השיבוץ שלך למשמרת אחה״צ 2026-10-27 עודכן')
  })
  it('an office/training day names the kind of work', () => {
    const msg = assignmentChangeMessage(date, 'morning', { agent_id: 'a', date, shift: 'morning', hospital_id: null, area: '', work_type: 'office', task_id: null, meeting_id: null, note: '' })
    expect(msg).toContain('משרד')
  })
})

describe('assignmentShort', () => {
  const names = (id: string) => ({ h1: 'שיבא' })[id as 'h1']
  it('a hospital assignment shows its name', () => {
    expect(assignmentShort({ hospital_id: 'h1', area: '', work_type: 'field' }, names)).toBe('שיבא')
  })
  it('no assignment at all is blank', () => {
    expect(assignmentShort(undefined, names)).toBe('')
  })
  it('plain field work with nothing else set is blank (nothing worth showing)', () => {
    expect(assignmentShort({ hospital_id: null, area: '', work_type: 'field' }, names)).toBe('')
  })
  it('office/training falls back to the kind of work', () => {
    expect(assignmentShort({ hospital_id: null, area: '', work_type: 'office' }, names)).toBe('משרד')
  })
})

describe('shiftLine', () => {
  it('not reported', () => { expect(shiftLine(undefined)).toBe('לא דווח') })
  it('available, with no mention of the shift itself (the heading already names it)', () => {
    expect(shiftLine({ status: 'available', reason: '' })).toBe('זמין')
  })
  it('unavailable, with the reason when there is one', () => {
    expect(shiftLine({ status: 'unavailable', reason: '' })).toBe('לא זמין')
    expect(shiftLine({ status: 'unavailable', reason: 'חופשה' })).toBe('לא זמין — חופשה')
  })
})

describe('availabilityToCopy', () => {
  const thisWeek = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
  const prevWeek = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']

  it('maps each previous-week day to the same weekday this week', () => {
    const prevRows = [{ date: '2026-10-27', shift: 'morning' as const, status: 'available' as const, reason: '' }]
    const out = availabilityToCopy(prevRows, thisWeek, prevWeek, () => false)
    expect(out).toEqual([{ date: '2026-11-03', shift: 'morning', status: 'available', reason: '' }])
  })
  it('never overwrites a day already reported this week', () => {
    const prevRows = [{ date: '2026-10-27', shift: 'morning' as const, status: 'unavailable' as const, reason: 'חופשה' }]
    expect(availabilityToCopy(prevRows, thisWeek, prevWeek, () => true)).toEqual([])
  })
  it('ignores a previous-week row outside the given week', () => {
    const prevRows = [{ date: '2026-10-18', shift: 'morning' as const, status: 'available' as const, reason: '' }]
    expect(availabilityToCopy(prevRows, thisWeek, prevWeek, () => false)).toEqual([])
  })
})

describe('assignmentsToCopy', () => {
  const thisWeek = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
  const prevWeek = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']

  it('carries the hospital and work type, never the task/meeting link', () => {
    const prevRows = [{ agent_id: 'a1', date: '2026-10-27', shift: 'morning' as const, hospital_id: 'h1', area: '', work_type: 'field' as const, note: 'הערה' }]
    const out = assignmentsToCopy(prevRows, thisWeek, prevWeek, () => false)
    expect(out).toEqual([{ agent_id: 'a1', date: '2026-11-03', shift: 'morning', hospital_id: 'h1', area: '', work_type: 'field', task_id: null, meeting_id: null, note: 'הערה' }])
  })
  it('skips a slot someone already assigned this week', () => {
    const prevRows = [{ agent_id: 'a1', date: '2026-10-27', shift: 'morning' as const, hospital_id: 'h1', area: '', work_type: 'field' as const, note: '' }]
    expect(assignmentsToCopy(prevRows, thisWeek, prevWeek, () => true)).toEqual([])
  })
})

describe('fillableShift', () => {
  it('fills an open, unreported or available shift', () => {
    expect(fillableShift(false, 'unset')).toBe(true)
    expect(fillableShift(false, 'available')).toBe(true)
  })
  it('never an already-assigned shift, or one the agent said they cannot work', () => {
    expect(fillableShift(true, 'available')).toBe(false)
    expect(fillableShift(false, 'unavailable')).toBe(false)
  })
})

describe('coverageGaps', () => {
  const dates = ['2026-10-27', '2026-10-28']
  const h1 = { id: 'h1', name: 'שיבא', covered: true }
  it('flags a covered hospital with an imminent scan and nobody assigned there that day', () => {
    const gaps = coverageGaps({
      dates,
      hospitals: [h1],
      scans: [{ hospital_id: 'h1', hospital_name: 'שיבא', ct_date: '2026-10-27', surgery_date: null, status: 'planned' }],
      isAssigned: () => false,
    })
    expect(gaps).toEqual([{ date: '2026-10-27', hospitalId: 'h1', hospitalName: 'שיבא', reasons: ['סריקת/ניתוח MAKO היום'] }])
  })
  it('not a gap once someone is assigned there that day', () => {
    const gaps = coverageGaps({
      dates,
      hospitals: [h1],
      scans: [{ hospital_id: 'h1', hospital_name: 'שיבא', ct_date: '2026-10-27', surgery_date: null, status: 'planned' }],
      isAssigned: (id, d) => id === 'h1' && d === '2026-10-27',
    })
    expect(gaps).toEqual([])
  })
  it('a hospital nobody covers at all is not a roster gap', () => {
    const gaps = coverageGaps({
      dates,
      hospitals: [{ id: 'h2', name: 'איכילוב', covered: false }],
      scans: [{ hospital_id: 'h2', hospital_name: 'איכילוב', ct_date: '2026-10-27', surgery_date: null, status: 'planned' }],
      isAssigned: () => false,
    })
    expect(gaps).toEqual([])
  })
  it('a done or cancelled scan does not count', () => {
    const gaps = coverageGaps({
      dates,
      hospitals: [h1],
      scans: [
        { hospital_id: 'h1', hospital_name: 'שיבא', ct_date: '2026-10-27', surgery_date: null, status: 'done' },
        { hospital_id: 'h1', hospital_name: 'שיבא', ct_date: '2026-10-28', surgery_date: null, status: 'cancelled' },
      ],
      isAssigned: () => false,
    })
    expect(gaps).toEqual([])
  })
})

describe('unreportedShifts', () => {
  const dates = ['2026-11-01', '2026-11-02']
  it('lists every shift with nothing reported, both shifts of each day', () => {
    const out = unreportedShifts(dates, () => false)
    expect(out).toHaveLength(4)
    expect(out).toContainEqual({ date: '2026-11-01', shift: 'morning' })
    expect(out).toContainEqual({ date: '2026-11-02', shift: 'evening' })
  })
  it('skips a shift already reported, available or not', () => {
    const out = unreportedShifts(dates, (date, shift) => date === '2026-11-01' && shift === 'morning')
    expect(out).toHaveLength(3)
    expect(out).not.toContainEqual({ date: '2026-11-01', shift: 'morning' })
  })
  it('a fully reported week has nothing left to fill', () => {
    expect(unreportedShifts(dates, () => true)).toEqual([])
  })
})

describe('assignmentConflicts', () => {
  it('flags an assignment against a reported "unavailable"', () => {
    expect(assignmentConflicts(true, 'unavailable')).toBe(true)
  })
  it('no conflict when nothing is assigned, or availability is anything else', () => {
    expect(assignmentConflicts(false, 'unavailable')).toBe(false)
    expect(assignmentConflicts(true, 'available')).toBe(false)
    expect(assignmentConflicts(true, 'unset')).toBe(false)
  })
})

describe('groupByHospital', () => {
  const agentName = (id: string) => ({ a1: 'דנה', a2: 'משה' })[id as 'a1' | 'a2']
  const hospitalName = (id: string) => ({ h1: 'איכילוב', h2: 'תל השומר' })[id as 'h1' | 'h2']

  it('groups assignments by hospital, sorted alphabetically', () => {
    const out = groupByHospital(
      [
        { agent_id: 'a1', shift: 'morning', hospital_id: 'h2', area: '', work_type: 'field' },
        { agent_id: 'a2', shift: 'morning', hospital_id: 'h1', area: '', work_type: 'field' },
      ],
      agentName,
      hospitalName,
    )
    expect(out.map((g) => g.hospitalName)).toEqual(['איכילוב', 'תל השומר'])
  })
  it('puts assignments with no hospital in a trailing "ללא בית חולים" group', () => {
    const out = groupByHospital(
      [
        { agent_id: 'a1', shift: 'morning', hospital_id: 'h1', area: '', work_type: 'field' },
        { agent_id: 'a2', shift: 'morning', hospital_id: null, area: '', work_type: 'office' },
      ],
      agentName,
      hospitalName,
    )
    expect(out.at(-1)?.hospitalName).toBe('ללא בית חולים')
    expect(out.at(-1)?.hospitalId).toBeNull()
  })
  it('within a hospital, sorts morning before evening', () => {
    const out = groupByHospital(
      [
        { agent_id: 'a1', shift: 'evening', hospital_id: 'h1', area: '', work_type: 'field' },
        { agent_id: 'a2', shift: 'morning', hospital_id: 'h1', area: '', work_type: 'field' },
      ],
      agentName,
      hospitalName,
    )
    expect(out[0].entries.map((e) => e.shift)).toEqual(['morning', 'evening'])
  })
  it('no assignments means no groups', () => {
    expect(groupByHospital([], agentName, hospitalName)).toEqual([])
  })
})
