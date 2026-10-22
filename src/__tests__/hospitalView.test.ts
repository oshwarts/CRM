import { describe, expect, it } from 'vitest'
import { heldMeetings, mailHref, telHref, isHeldMeeting, lastMetByDoctor, nextMeeting, surgeryList, volumeComparison, type SurgeryRow } from '../lib/hospitalView'

const T = '2026-10-22'
const m = (id: string, meeting_date: string | null, status: string, doctors: string[] = []) => ({ id, meeting_date, status, meeting_doctors: doctors.map((d) => ({ doctor: { id: d } })) })

describe('held meetings', () => {
  it('counts only done / needs_followup meetings that are not in the future', () => {
    expect(isHeldMeeting(m('a', T, 'done'), T)).toBe(true)
    expect(isHeldMeeting(m('a', '2026-10-21', 'needs_followup'), T)).toBe(true)
    expect(isHeldMeeting(m('a', '2026-10-21', 'scheduled'), T)).toBe(false) // date passed but it never happened
    expect(isHeldMeeting(m('a', '2026-10-21', 'cancelled'), T)).toBe(false)
    expect(isHeldMeeting(m('a', '2026-10-23', 'done'), T)).toBe(false)
    expect(isHeldMeeting(m('a', null, 'done'), T)).toBe(false)
  })
  it('orders newest first', () => {
    const r = heldMeetings([m('a', '2026-01-01', 'done'), m('b', '2026-10-01', 'done'), m('c', '2026-10-22', 'scheduled')], T)
    expect(r.map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('next meeting', () => {
  it('is the nearest scheduled one from today on', () => {
    const r = nextMeeting([m('far', '2026-12-01', 'scheduled'), m('today', T, 'scheduled'), m('near', '2026-10-25', 'scheduled'), m('old', '2026-10-01', 'scheduled')], T)
    expect(r?.id).toBe('today')
    expect(nextMeeting([m('x', '2026-10-25', 'cancelled'), m('y', '2026-10-01', 'scheduled')], T)).toBeNull()
  })
})

describe('last met a doctor', () => {
  it('keeps the latest held date per doctor and ignores scheduled / future / cancelled', () => {
    const map = lastMetByDoctor([m('1', '2026-09-01', 'done', ['d1', 'd2']), m('2', '2026-10-10', 'done', ['d1']), m('3', '2026-10-21', 'scheduled', ['d2']), m('4', '2026-11-01', 'done', ['d2'])], T)
    expect(map.get('d1')).toBe('2026-10-10')
    expect(map.get('d2')).toBe('2026-09-01')
    expect(map.has('d3')).toBe(false)
  })
})

describe('case volume comparison', () => {
  const v = (year: number, count: number, name: string | null) => ({ year, count, procedure: name ? { name } : null })
  it('compares the latest year with the one before and sums rows of one procedure', () => {
    const r = volumeComparison([v(2026, 40, 'ברך'), v(2026, 12, 'ברך'), v(2026, 7, 'ירך'), v(2025, 30, 'ברך'), v(2025, 20, 'ירך'), v(2023, 99, 'ברך')])
    expect(r.year).toBe(2026)
    expect(r.prevYear).toBe(2025)
    expect(r.rows).toEqual([
      { name: 'ברך', now: 52, prev: 30 },
      { name: 'ירך', now: 7, prev: 20 },
    ])
  })
  it('takes the previous year even when a year is missing between them', () => {
    const r = volumeComparison([v(2026, 3, 'ברך'), v(2023, 5, 'ברך')])
    expect([r.year, r.prevYear]).toEqual([2026, 2023])
    expect(r.rows[0]).toEqual({ name: 'ברך', now: 3, prev: 5 })
  })
  it('handles no data, one year, zero counts and a missing procedure name', () => {
    expect(volumeComparison([])).toEqual({ year: null, prevYear: null, rows: [] })
    const one = volumeComparison([v(2026, 4, null), v(2026, 0, 'אפס')])
    expect(one.prevYear).toBeNull()
    expect(one.rows).toEqual([{ name: '—', now: 4, prev: 0 }])
  })
})

describe('surgery list', () => {
  const s = (key: string, date: string, status: string): SurgeryRow => ({ key, date, surgeon: '', what: '', cases: 1, status })
  it('puts the planned ones first (soonest first), then the newest of the rest', () => {
    const { upcoming, shown } = surgeryList([s('past-done', '2026-10-01', 'done'), s('later', '2026-11-30', 'planned'), s('soon', '2026-10-23', 'planned'), s('cancelled-future', '2026-10-24', 'cancelled'), s('today', T, 'planned'), s('older', '2026-05-01', 'done')], T)
    expect(upcoming.map((x) => x.key)).toEqual(['today', 'soon', 'later'])
    expect(shown.map((x) => x.key)).toEqual(['today', 'soon', 'later', 'cancelled-future', 'past-done', 'older'])
  })
  it('limits the older rows', () => {
    const rows = Array.from({ length: 30 }, (_, i) => s(`p${i}`, `2025-01-${String(i + 1).padStart(2, '0')}`, 'done'))
    expect(surgeryList(rows, T, 20).shown).toHaveLength(20)
    expect(surgeryList(rows, T, 20).shown[0].key).toBe('p29')
  })
})

describe('contact links', () => {
  it('keeps only dialable characters in a tel: link', () => {
    expect(telHref('050-111 2222')).toBe('tel:0501112222')
    expect(telHref('+972 (50) 123-4567')).toBe('tel:+972501234567')
    expect(telHref('03-5302222,123#')).toBe('tel:035302222,123#')
  })
  it('keeps the e-mail as typed, without spaces', () => {
    expect(mailHref(' dana@x.test ')).toBe('mailto:dana@x.test')
    expect(mailHref('rachel@shiba.test')).toBe('mailto:rachel@shiba.test')
  })
})
