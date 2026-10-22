import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QUICK_TESTS, rescanAlert, rowFlags, weekMissing } from '../lib/scanAlerts'
import { buildIcs, implantSummary, scanEvents, scansToText } from '../lib/scanExport'
import { matchesScanQuery, parseScanParams, revealScan } from '../lib/scanList'
import { implantFieldsOf, optionsForField } from '../lib/implants'
import { parseReferral } from '../lib/referralParse'
import { csvCell, csvTextDigits } from '../lib/utils'
import type { ImplantOption, PatientScanRow } from '../lib/types'

/** a local date n days from the (faked) today */
const day = (n: number) => {
  const x = new Date()
  x.setDate(x.getDate() + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const scan = (o: Partial<PatientScanRow> = {}) =>
  ({
    id: 's', hospital_id: 'h1', hospital: { id: 'h1', name: 'שיבא' }, surgeon_id: 'd1', surgeon: { id: 'd1', name: 'יוסי כהן', title: 'ד״ר' },
    patient_name: 'ישראל ישראלי', patient_phone: '', patient_id_number: '', patient_dob: null, health_fund: '', insurance: '',
    procedure_type: 'knee', side: 'ימין', surgery_date: null, ct_date: null, ct_time: null, scanned: false, uploaded: false, disk_collected: false,
    plan_ready: false, rescan: false, rescan_date: null, rescan_reason: '', rescan_done: false, status: 'planned', implant_data: {}, notes: '',
    anaesthesia_note: '', ...o,
  }) as unknown as PatientScanRow

describe('scan alerts at the day boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 22, 23, 59, 30)) // a minute before midnight, local time
  })
  afterEach(() => vi.useRealTimers())

  it('a CT today is not overdue, a CT yesterday is', () => {
    expect(QUICK_TESTS.overdue(scan({ ct_date: day(0) }))).toBe(false)
    expect(QUICK_TESTS.overdue(scan({ ct_date: day(-1) }))).toBe(true)
    expect(rowFlags(scan({ ct_date: day(-1) })).overdueRow).toBe(true)
    expect(rowFlags(scan({ ct_date: day(0) })).overdueRow).toBe(false)
  })
  it('after midnight the same CT becomes overdue', () => {
    const s = scan({ ct_date: day(0) })
    vi.setSystemTime(new Date(2026, 9, 23, 0, 0, 5))
    expect(QUICK_TESTS.overdue(s)).toBe(true)
  })
  it('a scanned CT, or a cancelled surgery, is never overdue / soon', () => {
    expect(QUICK_TESTS.overdue(scan({ ct_date: day(-5), scanned: true }))).toBe(false)
    expect(QUICK_TESTS.overdue(scan({ ct_date: day(-5), status: 'cancelled' }))).toBe(false)
    expect(QUICK_TESTS.week(scan({ ct_date: day(2), status: 'cancelled' }))).toBe(false)
    expect(rowFlags(scan({ ct_date: day(1), status: 'cancelled' })).soon).toBe(false)
  })
  it('"surgery this week without CT" covers today..7 days, not 8, not yesterday, not a cancelled one', () => {
    expect(QUICK_TESTS.noct(scan({ surgery_date: day(0) }))).toBe(true)
    expect(QUICK_TESTS.noct(scan({ surgery_date: day(7) }))).toBe(true)
    expect(QUICK_TESTS.noct(scan({ surgery_date: day(8) }))).toBe(false)
    expect(QUICK_TESTS.noct(scan({ surgery_date: day(-1) }))).toBe(false)
    expect(QUICK_TESTS.noct(scan({ surgery_date: day(3), status: 'cancelled' }))).toBe(false)
    expect(QUICK_TESTS.noct(scan({ surgery_date: day(3), ct_date: day(1) }))).toBe(false)
    expect(rowFlags(scan({ surgery_date: day(3) })).noCtSoon).toBe(true)
  })
  it('"surgery this week without disk" needs a CT date and no disk', () => {
    expect(QUICK_TESTS.nodisk(scan({ surgery_date: day(3), ct_date: day(-1) }))).toBe(true)
    expect(QUICK_TESTS.nodisk(scan({ surgery_date: day(3), ct_date: day(-1), disk_collected: true }))).toBe(false)
    expect(QUICK_TESTS.nodisk(scan({ surgery_date: day(3) }))).toBe(false)
    expect(rowFlags(scan({ surgery_date: day(3), ct_date: day(-1) })).noDiskSoon).toBe(true)
  })
  it('what is missing for a CT in the coming 7 days', () => {
    expect(weekMissing(scan({ ct_date: day(2) }))).toEqual(['CT טרם בוצע', 'תוכנית לא מוכנה'])
    expect(weekMissing(scan({ ct_date: day(2), scanned: true }))).toEqual(['דיסק לא הועלה', 'תוכנית לא מוכנה'])
    expect(weekMissing(scan({ ct_date: day(2), scanned: true, disk_collected: true, plan_ready: true }))).toEqual([])
    expect(weekMissing(scan({ ct_date: day(8) }))).toEqual([])
    expect(weekMissing(scan({ ct_date: day(-1) }))).toEqual([])
    expect(weekMissing(scan({ ct_date: day(2), status: 'cancelled' }))).toEqual([])
    expect(QUICK_TESTS.open(scan({ ct_date: day(0) }))).toBe(true)
  })
  it('re-scan alerts: no date, overdue, today, soon, later, done', () => {
    const r = (o: Partial<PatientScanRow>) => rescanAlert(scan({ rescan: true, ...o }))
    expect(r({})).toBe('nodate')
    expect(r({ rescan_date: day(-1) })).toBe('overdue')
    expect(r({ rescan_date: day(0) })).toBe('today')
    expect(r({ rescan_date: day(7) })).toBe('soon')
    expect(r({ rescan_date: day(8) })).toBe(null)
    expect(r({ rescan_done: true })).toBe(null)
    expect(r({ status: 'cancelled' })).toBe(null)
    expect(rescanAlert(scan())).toBe(null)
    expect(QUICK_TESTS.rescan(scan({ rescan: true, rescan_date: day(30) }))).toBe(true)
    expect(QUICK_TESTS.rescan(scan({ rescan: true, rescan_done: true }))).toBe(false)
  })
  it('postponed / no-date chips', () => {
    expect(QUICK_TESTS.postponed(scan({ status: 'postponed' }))).toBe(true)
    expect(QUICK_TESTS.nodate(scan({ status: 'planned' }))).toBe(true)
    expect(QUICK_TESTS.nodate(scan({ status: 'planned', surgery_date: day(2) }))).toBe(false)
    expect(QUICK_TESTS.nodate(scan({ status: 'postponed' }))).toBe(false)
  })
})

describe('the search box', () => {
  const s = scan({ patient_name: 'אברג׳ל תקוה', patient_phone: '050-111-2233', patient_id_number: '037372901' })
  it('finds by name without quotes / niqqud, by final letters half typed, by surgeon and hospital', () => {
    expect(matchesScanQuery(s, 'אברגל')).toBe(true)
    expect(matchesScanQuery(s, 'תקו')).toBe(true)
    expect(matchesScanQuery(s, 'כהן')).toBe(true)
    expect(matchesScanQuery(s, 'שיבא')).toBe(true)
    expect(matchesScanQuery(s, 'תקוה כהן')).toBe(true)
    expect(matchesScanQuery(s, 'תקוה לוי')).toBe(false)
  })
  it('finds by digits of the phone (with or without dashes) and of the ID', () => {
    expect(matchesScanQuery(s, '0501112233')).toBe(true)
    expect(matchesScanQuery(s, '050-111')).toBe(true)
    expect(matchesScanQuery(s, '3737')).toBe(true)
    expect(matchesScanQuery(s, '999')).toBe(false)
  })
  it('an empty or blank search matches everything; a digit word never matches the name', () => {
    expect(matchesScanQuery(s, '')).toBe(true)
    expect(matchesScanQuery(s, '   ')).toBe(true)
    expect(matchesScanQuery(scan({ patient_name: 'מטופל 77' }), '77')).toBe(false)
  })
})

describe('implant sizes depend on the head', () => {
  const o = (id: string, category: string, value: string, parent_id: string | null = null, sort = 0) => ({ id, category, value, parent_id, sort }) as ImplantOption
  const options = [o('1', 'hip_head', '32'), o('2', 'hip_head', '36'), o('3', 'hip_neck', '0', null, 1), o('4', 'hip_neck', '+2.5', null, 2), o('5', 'hip_neck', '+5', null, 3), o('6', 'hip_neck', '0', '2', 1), o('7', 'hip_neck', '+2.5', '2', 2)]
  const fields = implantFieldsOf('hip', null)
  const neck = fields.find((f) => f.key === 'neck')!
  it('the built-in hip form has neck depending on head', () => expect(neck.depends_on).toBe('hip_head'))
  it('no head chosen, or a head with no list of its own: the general neck list', () => {
    expect(optionsForField(neck, {}, fields, options).values).toEqual(['0', '+2.5', '+5'])
    expect(optionsForField(neck, { head: '32' }, fields, options)).toEqual({ values: ['0', '+2.5', '+5'], narrowedBy: null })
  })
  it('a head with its own list narrows the neck sizes (and says so)', () => {
    expect(optionsForField(neck, { head: '36' }, fields, options)).toEqual({ values: ['0', '+2.5'], narrowedBy: 'Head 36' })
    expect(optionsForField(neck, { head: ' 36 ' }, fields, options).values).toEqual(['0', '+2.5'])
  })
  it('implantSummary lists only the filled fields of the procedure', () => {
    expect(implantSummary(scan({ procedure_type: 'hip', implant_data: { head: '36', neck: '+2.5', femur: '4' } }))).toBe('Head 36 · Neck +2.5')
    expect(implantSummary(scan({ procedure_type: 'knee', implant_data: {} }))).toBe('')
  })
})

describe('calendar invitation (ICS)', () => {
  it('folds lines by BYTES (Hebrew is 2 bytes a letter) and never cuts a character', () => {
    const s = scan({ id: 'x1', patient_name: 'א'.repeat(120), ct_date: '2026-11-03', ct_time: '09:30:00', notes: 'שורה 1\nשורה 2, עם; פסיק' })
    const ics = buildIcs(scanEvents(s))
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    // unfolded again, the summary is complete
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('SUMMARY:סריקת CT — ' + 'א'.repeat(120))
    expect(unfolded).toContain('DTSTART:20261103T093000')
    expect(unfolded).toContain('DTEND:20261103T103000')
    expect(unfolded).toContain('\\n') // newlines in the notes are escaped
    expect(unfolded).toContain('עם\\; פסיק')
    expect(ics.endsWith('\r\n')).toBe(true)
  })
  it('a CT without a time is an all-day event ending the next day (also across a month end)', () => {
    const ics = buildIcs(scanEvents(scan({ id: 'x2', ct_date: '2026-10-31' })))
    expect(ics).toContain('DTSTART;VALUE=DATE:20261031')
    expect(ics).toContain('DTEND;VALUE=DATE:20261101')
    expect(buildIcs([{ uid: 'u', title: 't', date: '2026-12-31', time: 'garbage' }])).toContain('DTEND;VALUE=DATE:20270101')
  })
  it('a CT and a re-scan are two events; none without dates', () => {
    expect(scanEvents(scan({ ct_date: '2026-11-03', rescan: true, rescan_date: '2026-11-10' }))).toHaveLength(2)
    expect(scanEvents(scan({ rescan: true, rescan_date: null }))).toHaveLength(0)
    expect(rowFlags(scan()).hasEvents).toBe(false)
  })
  it('the invitation carries the patient name and phone (it goes to the agent’s own calendar) but never the ID number', () => {
    const ics = buildIcs(scanEvents(scan({ ct_date: '2026-11-03', patient_phone: '050-1', patient_id_number: '037372901', patient_dob: '1950-01-01' })))
    expect(ics).not.toContain('037372901')
    expect(ics).not.toContain('1950')
  })
})

describe('copied text', () => {
  it('has the name, hospital, dates and procedure — no ID, phone, date of birth, insurance or notes', () => {
    const t = scansToText([scan({ patient_name: 'דנה', patient_phone: '0501234567', patient_id_number: '037372901', patient_dob: '1950-01-01', insurance: 'הראל', notes: 'סודי', surgery_date: '2026-11-03', ct_date: '2026-10-30', ct_time: '08:15:00' })])
    expect(t).toContain('1. דנה — שיבא')
    expect(t).toContain('ניתוח 03/11/2026')
    expect(t).toContain('CT 30/10/2026 08:15')
    for (const secret of ['0501234567', '037372901', '1950', 'הראל', 'סודי']) expect(t).not.toContain(secret)
  })
  it('a scan without a CT says so', () => expect(scansToText([scan()])).toContain('CT: לא נקבע'))
})

describe('CSV cells (formula injection)', () => {
  it('neutralises =, +, -, @ at the start of a text but keeps plain numbers and phone numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+cmd|calc')).toBe("'+cmd|calc")
    expect(csvCell('@evil')).toBe("'@evil")
    expect(csvCell('-1+1')).toBe("'-1+1")
    expect(csvCell('+2.5')).toBe('+2.5')
    expect(csvCell('שם, עם פסיק')).toBe('"שם, עם פסיק"')
    expect(csvCell(null)).toBe('')
  })
})

describe('referral reading', () => {
  const base = { fileName: '', fileText: '', today: new Date(2026, 9, 22), doctors: [], hospitals: [], existing: [] as PatientScanRow[] }
  it('reads a date without a year as the next time it comes around', () => {
    expect(parseReferral({ ...base, message: 'ניתוח ב-5.11' }).draft.surgery_date).toBe('2026-11-05')
    expect(parseReferral({ ...base, message: 'ניתוח ב-5.10' }).draft.surgery_date).toBe('2027-10-05')
    expect(parseReferral({ ...base, message: 'ניתוח ב-22/10' }).draft.surgery_date).toBe('2026-10-22')
  })
  it('a day that does not exist (31/4, 30/2) is not a date', () => {
    expect(parseReferral({ ...base, message: 'ניתוח 31/4' }).draft.surgery_date).toBeUndefined()
    expect(parseReferral({ ...base, message: 'ניתוח 30.2.27' }).draft.surgery_date).toBeUndefined()
    expect(parseReferral({ ...base, message: 'ניתוח 31/4 או 2/5' }).draft.surgery_date).toBe('2027-05-02')
  })
  it('never invents a surgeon: an unknown one stays empty with a notice to choose by hand', () => {
    const r = parseReferral({ ...base, message: 'דר פלוני אלמוני\nברך שמאל', doctors: [{ id: 'd1', name: 'יוסי כהן', title: 'ד״ר' }] })
    expect(r.draft.surgeon_id).toBeUndefined()
    expect(r.notices.join(' ')).toContain('המנתח לא זוהה')
    expect(r.notices.join(' ')).toContain('"פלוני אלמוני" לא נמצא ברשימת הרופאים')
  })
  it('finds a known surgeon, an ID with a valid check digit, a phone and the side', () => {
    const r = parseReferral({ ...base, message: 'יוסי כהן\nישראל ישראלי 037372901 050-1112233 ברך שמאל', doctors: [{ id: 'd1', name: 'יוסי כהן', title: 'ד״ר' }] })
    expect(r.draft.surgeon_id).toBe('d1')
    expect(r.draft.patient_id_number).toBe('037372901')
    expect((r.draft.patient_phone ?? '').replace(/\D/g, '')).toBe('0501112233')
    expect(r.draft.side).toBe('שמאל')
    expect(r.draft.procedure_type).toBe('knee')
  })
  it('warns about an ID that fails the check digit and about a duplicate patient', () => {
    const r = parseReferral({ ...base, message: 'ישראל ישראלי 123456789', existing: [scan({ patient_id_number: '123456789', patient_name: 'קיים' })] })
    const t = r.notices.join(' ')
    expect(t).toContain('לא עובר בדיקת תקינות')
    expect(t).toContain('כבר קיים מטופל')
  })
})

describe('CSV: ID and phone stay text in Excel', () => {
  it('keeps the leading zero with ="…" for digits, dashes, spaces and a leading plus', () => {
    expect(csvTextDigits('037372901')).toBe('="037372901"')
    expect(csvTextDigits('050-111 2233')).toBe('="050-111 2233"')
    expect(csvTextDigits('+972-50-1234567')).toBe('="+972-50-1234567"')
    expect(csvTextDigits(' 0371234 ')).toBe('="0371234"')
  })
  it('anything else is a normal cell, injection included', () => {
    expect(csvTextDigits('')).toBe('')
    expect(csvTextDigits(null)).toBe('')
    expect(csvTextDigits('=1+1')).toBe("'=1+1")
    expect(csvTextDigits('050"),A1')).toBe('"050"")' + ',A1"')
    expect(csvTextDigits('0501234567; =cmd')).toBe('0501234567; =cmd')
    expect(csvTextDigits('-')).toBe("'-")
    expect(csvTextDigits('@123')).toBe("'@123")
    expect(csvTextDigits('12\n34')).toBe('"12\n34"')
  })
})

describe('a link to the scans screen', () => {
  const p = (q: string) => parseScanParams(new URLSearchParams(q))
  it('opens on the default window; from a hospital on the coming month', () => {
    expect(p('')).toEqual({ hospital: '', window: 'w2', highlight: '' })
    expect(p('hospital=h1')).toEqual({ hospital: 'h1', window: 'month', highlight: '' })
  })
  it('an explicit window wins (all, past, w1, w2, month); an unknown one is ignored', () => {
    expect(p('hospital=h1&window=all').window).toBe('all')
    expect(p('window=past').window).toBe('past')
    expect(p('window=w1').window).toBe('w1')
    expect(p('window=bogus').window).toBe('w2')
    expect(p('hospital=h1&window=toString').window).toBe('month')
  })
  it('carries the scan to highlight', () => expect(p('hospital=h1&window=all&highlight=abc').highlight).toBe('abc'))
  it('reveal: the window widens to the whole list when the scan is outside it; another hospital is dropped', () => {
    const s = { hospital_id: 'h1', surgery_date: '2026-12-30', status: 'planned' }
    expect(revealScan(s, { hospital: 'h1', window: 'w2' }, '2026-10-22')).toEqual({ hospital: 'h1', window: 'all' })
    expect(revealScan(s, { hospital: 'h2', window: 'all' }, '2026-10-22')).toEqual({ hospital: '', window: 'all' })
    expect(revealScan({ ...s, surgery_date: '2026-10-25' }, { hospital: '', window: 'w2' }, '2026-10-22')).toEqual({ hospital: '', window: 'w2' })
    expect(revealScan({ ...s, status: 'done' }, { hospital: '', window: 'w2' }, '2026-10-22').window).toBe('all')
  })
})
