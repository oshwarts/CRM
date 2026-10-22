import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDoctorRows, daysBetween, STALE_DAYS, titleOptions } from '../lib/doctorStats'
import { contactState } from '../lib/cadence'
import { findDuplicateDoctors, matchesWords, normalizeHe, phoneKey, searchKey, searchWords } from '../lib/contactMatch'
import { telHref, whatsappNumber } from '../components/QuickContact'

// "today" of every test: Tuesday 20 October 2026
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T10:00:00'))
})
afterEach(() => vi.useRealTimers())

const day = (n: number) => {
  const x = new Date('2026-10-20T10:00:00')
  x.setDate(x.getDate() + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const doc = (id: string, o: Record<string, unknown> = {}) =>
  ({ id, name: id, title: '', status: 'client', phone: '050-1234567', email: '', contact_cadence_days: null, created_at: '2026-01-01T00:00:00Z', doctor_hospitals: [{ hospital_id: 'h', hospital: { name: 'שיבא' } }], doctor_procedures: [{ procedure_id: 'p' }], doctor_companies: [], doctor_robotic_systems: [], ...o }) as never
const meeting = (docId: string, date: string, status: string) => ({ meeting_date: date, status, meeting_doctors: [{ doctor: { id: docId } }] }) as never
const need = (d: unknown, meetings: unknown[] = []) =>
  buildDoctorRows({ doctors: [d as never], meetings: meetings as never, scans: [], planned: [], intel: [], robotNames: new Map(), companyNames: new Map(), windowDays: 90 })[0]

describe('who needs contact', () => {
  it('a cadence that is over is "due", with the days of delay', () => {
    const r = need(doc('a', { contact_cadence_days: 30 }), [meeting('a', day(-40), 'done')])
    expect(r.need).toBe('due')
    expect(r.contact.daysToDue).toBe(-10)
    expect(r.daysSince).toBe(40)
  })
  it('within a week of the due date is "soon", further away is fine', () => {
    expect(need(doc('a', { contact_cadence_days: 30 }), [meeting('a', day(-25), 'done')]).need).toBe('soon') // due in 5 days
    expect(need(doc('a', { contact_cadence_days: 30 }), [meeting('a', day(-23), 'done')]).need).toBe('soon') // due in 7 days
    expect(need(doc('a', { contact_cadence_days: 30 }), [meeting('a', day(-22), 'done')]).need).toBe('') // due in 8 days
    expect(need(doc('a', { contact_cadence_days: 30 }), [meeting('a', day(-30), 'done')]).need).toBe('soon') // due today, not late yet
    expect(need(doc('a', { contact_cadence_days: 30 }), [meeting('a', day(-31), 'done')]).need).toBe('due')
  })
  it('a meeting that is already scheduled removes the alert', () => {
    const r = need(doc('a', { contact_cadence_days: 30 }), [meeting('a', day(-40), 'done'), meeting('a', day(3), 'scheduled')])
    expect(r.need).toBe('')
    expect(r.contact.nextMeeting).toBe(day(3))
    const noCadence = need(doc('b'), [meeting('b', day(-100), 'done'), meeting('b', day(5), 'scheduled')])
    expect(noCadence.need).toBe('')
  })
  it('a "scheduled" meeting in the past that was never closed is not contact', () => {
    const r = need(doc('a', { contact_cadence_days: 14, created_at: '2026-01-01T00:00:00Z' }), [meeting('a', day(-10), 'scheduled')])
    expect(r.contact.lastDate).toBeNull()
    expect(r.need).toBe('due')
    // today's meeting that is still "scheduled" counts as the next meeting, not as the last one
    const today = need(doc('b', { contact_cadence_days: 14 }), [meeting('b', day(0), 'scheduled')])
    expect(today.contact.nextMeeting).toBe(day(0))
    expect(today.contact.lastDate).toBeNull()
    expect(today.need).toBe('')
  })
  it('cancelled meetings are nothing; "needs follow-up" is a meeting that took place', () => {
    expect(need(doc('a'), [meeting('a', day(-5), 'cancelled')]).contact.lastDate).toBeNull()
    expect(need(doc('a'), [meeting('a', day(-5), 'needs_followup')]).contact.lastDate).toBe(day(-5))
  })
  it(`without a cadence: ${STALE_DAYS} days without contact is "stale", one day less is not`, () => {
    expect(need(doc('a'), [meeting('a', day(-STALE_DAYS), 'done')]).need).toBe('stale')
    expect(need(doc('a'), [meeting('a', day(-STALE_DAYS + 1), 'done')]).need).toBe('')
    expect(need(doc('a'), [meeting('a', day(-10), 'done')]).need).toBe('')
  })
  it('never met: the clock starts when the doctor was added', () => {
    const old = need(doc('a', { created_at: `${day(-100)}T08:00:00Z` }))
    expect(old.need).toBe('stale')
    expect(old.daysSince).toBeNull()
    expect(old.idleDays).toBe(100)
    expect(need(doc('b', { created_at: `${day(-1)}T08:00:00Z` })).need).toBe('')
    // with a cadence: also from the day he was added
    expect(need(doc('c', { contact_cadence_days: 7, created_at: `${day(-3)}T08:00:00Z` })).need).toBe('soon')
  })
  it('a doctor who is not relevant never needs contact', () => {
    expect(need(doc('a', { status: 'lost', contact_cadence_days: 7 })).need).toBe('')
  })
  it('a meeting of today counts as 0 days; a meeting of another doctor does not count', () => {
    const r = need(doc('a'), [meeting('a', day(0), 'done'), meeting('zzz', day(-1), 'done')])
    expect(r.daysSince).toBe(0)
    expect(r.contact.lastDate).toBe(day(0))
  })
  it('missing details are listed', () => {
    const r = need(doc('a', { phone: '', doctor_hospitals: [], doctor_procedures: [] }))
    expect(r.missing).toEqual(['טלפון', 'בית חולים', 'הליכים'])
    expect(need(doc('b')).missing).toEqual([])
  })
})

describe('surgeries in the window and loyalty', () => {
  const scan = (surgeon_id: string | null, n: number | null, status = 'done') => ({ surgeon_id, surgery_date: n === null ? null : day(n), status }) as never
  const run = (windowDays: number) =>
    buildDoctorRows({
      doctors: [doc('a'), doc('b')],
      meetings: [],
      scans: [scan('a', -10), scan('a', -80), scan('a', -120), scan('a', -5, 'cancelled'), scan('a', 7, 'planned'), scan('a', null, 'planned'), scan(null, -1), scan('b', 0)],
      planned: [
        { doctor_id: 'a', surgery_date: day(-3), cases: 3, status: 'done' },
        { doctor_id: 'a', surgery_date: day(-3), cases: 9, status: 'cancelled' },
        { doctor_id: 'b', surgery_date: day(-2), cases: null, status: 'planned' },
      ] as never,
      intel: [
        { doctor_id: 'a', loyalty: 'loyal' },
        { doctor_id: 'a', loyalty: 'open' },
        { doctor_id: 'b', loyalty: '' },
        { doctor_id: null, loyalty: 'loyal' },
      ] as never,
      robotNames: new Map(),
      companyNames: new Map(),
      windowDays,
    })
  it('counts the finished and planned-until-today surgeries of the window, not cancelled or future ones', () => {
    const [a, b] = run(90)
    expect(a.surgeries).toBe(1 + 1 + 3) // two scans in the window + 3 cases
    expect(b.surgeries).toBe(1 + 1) // a scan of today + a planned entry without a count = 1 case
    expect(run(180)[0].surgeries).toBe(6)
    expect(run(30)[0].surgeries).toBe(4) // the scan of -10 and the 3 cases
  })
  it('the newest statement of loyalty wins; an empty one is no loyalty', () => {
    const [a, b] = run(90)
    expect(a.loyalty).toBe('loyal')
    expect(b.loyalty).toBe('')
  })
})

describe('days', () => {
  it('daysBetween is whole local days, also across the change of the clock', () => {
    expect(daysBetween('2026-03-26', '2026-03-28')).toBe(2) // Israel changes to summer time on 27 March 2026
    expect(daysBetween('2026-10-20', '2026-10-20')).toBe(0)
    expect(daysBetween('2026-10-25', '2026-10-24')).toBe(-1)
  })
  it('contactState works from the local day', () => {
    expect(contactState({ id: 'a', contact_cadence_days: 7, created_at: `${day(-6)}T00:00:00Z` }, []).daysToDue).toBe(1)
  })
})

describe('search', () => {
  const find = (q: string, hay: string) => matchesWords(searchWords(q), searchKey(hay))
  it('ignores case, quotes, niqqud and dashes', () => {
    expect(normalizeHe('כֹּהֵן')).toBe('כהן')
    expect(find('כהן', 'ד״ר כֹּהֵן אֲבִיעֵזֶר')).toBe(true)
    expect(find('בר לב', 'עמוס בר־לב')).toBe(true)
    expect(find('DR smith', 'dr. John Smith')).toBe(true)
    expect(find('בן-גוריון', 'בן גוריון')).toBe(true)
  })
  it('final letters and regular letters are the same', () => {
    expect(find('אברהמ', 'אברהם')).toBe(true)
    expect(find('כהנ', 'כהן')).toBe(true)
  })
  it('every word has to be there, in any order', () => {
    expect(find('כהן אבי', 'אבי כהן שיבא')).toBe(true)
    expect(find('כהן דוד', 'אבי כהן שיבא')).toBe(false)
  })
  it('a one-letter prefix is ignored: "בשיבא", "מאיכילוב"', () => {
    expect(find('בשיבא', 'אבי כהן שיבא – תל השומר')).toBe(true)
    expect(find('מאיכילוב', 'דוד לוי איכילוב')).toBe(true)
    expect(find('לוי', 'ללוי')).toBe(true) // plain match still works
    expect(find('בשבא', 'שיבא')).toBe(false)
    // short words are not cut: "בן" must not match "ן"
    expect(find('בני', 'ני')).toBe(false)
  })
  it('an empty search matches everything', () => {
    expect(searchWords('   ')).toEqual([])
    expect(matchesWords([], 'x')).toBe(true)
  })
})

describe('duplicate doctors', () => {
  const list = [
    { id: '1', name: 'אבי כהן', phone: '050-1234567', email: 'avi@x.co' },
    { id: '2', name: 'דוד לוי', phone: '', email: '' },
    { id: '3', name: 'משה בן לולו', phone: '03-5551234', email: '' },
  ]
  const f = (name: string, phone = '', email = '', exclude?: string) => findDuplicateDoctors({ name, phone, email }, list, exclude).map((x) => `${x.doctor.id}:${x.reason}`)
  it('the same phone in any format', () => {
    expect(f('מישהו אחר', '+972-50-123-4567')).toEqual(['1:phone'])
    expect(f('מישהו אחר', '972501234567')).toEqual(['1:phone'])
    expect(phoneKey('1234')).toBe('') // too short to be a number
  })
  it('the same e-mail in any case', () => {
    expect(f('מישהו אחר', '', ' AVI@x.co ')).toEqual(['1:email'])
  })
  it('the same name: titles and word order are ignored', () => {
    expect(f('דר כהן אבי')).toEqual(['1:name'])
    expect(f('פרופ׳ דוד לוי')).toEqual(['2:name'])
  })
  it('a longer name that contains an existing one is only "similar"', () => {
    expect(f('משה בן לולו הגדול')).toEqual(['3:similar'])
    expect(f('אבי')).toEqual([]) // one word of a two-word name is not enough
  })
  it('a different doctor is not a duplicate, and the doctor himself is skipped', () => {
    expect(f('רונית שמש', '052-9999999', 'a@b.co')).toEqual([])
    expect(f('אבי כהן', '', '', '1')).toEqual([])
  })
  it('the strongest reason comes first', () => {
    expect(f('דוד לוי', '050-1234567')).toEqual(['1:phone', '2:name'])
  })
})

describe('quick contact links', () => {
  it('05x → 9725x, whatever the formatting', () => {
    expect(whatsappNumber('052-123 4567')).toBe('972521234567')
    expect(whatsappNumber('(054) 123 4567')).toBe('972541234567')
    expect(whatsappNumber('+972 (0)52-123-4567')).toBe('972521234567')
    expect(whatsappNumber('00972521234567')).toBe('972521234567')
    expect(whatsappNumber('03-5551234')).toBe('97235551234')
    expect(whatsappNumber('+1 415 555 2671')).toBe('14155552671')
    expect(whatsappNumber('')).toBe('')
  })
  it('an extension is not part of the number', () => {
    expect(whatsappNumber('03-5551234 ext 5')).toBe('97235551234')
    expect(whatsappNumber('052 123 4567 שלוחה 12')).toBe('972521234567')
    expect(telHref('03-5551234 x5')).toBe('tel:035551234')
  })
  it('tel: keeps the + and drops spaces and brackets; text without digits gives no link', () => {
    expect(telHref('+972-52-123-4567')).toBe('tel:+972521234567')
    expect(telHref('(054) 123 4567')).toBe('tel:0541234567')
    expect(telHref('אין')).toBe('')
    expect(telHref('')).toBe('')
  })
})

describe('title options of the doctor form', () => {
  const std = ['דוקטור', 'פרופסור', 'מר', 'גברת']
  it('a standard title (or none) adds nothing', () => {
    expect(titleOptions('פרופסור', std)).toEqual(std)
    expect(titleOptions('', std)).toEqual(std)
    expect(titleOptions(null, std)).toEqual(std)
  })
  it("a doctor's own title is offered first, so that it is shown and kept", () => {
    expect(titleOptions('ד״ר', std)).toEqual(['ד״ר', ...std])
    expect(titleOptions(' פרופ׳ ', std)).toEqual(['פרופ׳', ...std])
    expect(titleOptions('ד"ר', std)[0]).toBe('ד"ר')
  })
})
