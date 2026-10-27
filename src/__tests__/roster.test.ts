import { describe, expect, it } from 'vitest'
import { availabilityLine, dayAvailability, overloaded, suggestionsFor, teamLoad, weekDates } from '../lib/roster'

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
