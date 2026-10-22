// Seed of /scans: every alert kind, boundary dates, awkward text, implant sizes, MAKO hospitals. ?many=1 adds 300 more scans (performance).
// Expected on a default load (window = two weeks, nearest surgery first): see the ids below.
//   a1 surgery in 3 days, no CT (noCtSoon) · a2 surgery in 5 days, CT done but no disk (noDiskSoon) · a3 CT passed 3 days ago, not scanned
//   a4 CT in 2 days · a5 re-scan overdue · a6 re-scan without a date · a7 cancelled (CT passed, no alerts) · a8 awkward text · a9 hip with sizes
//   a10 done, surgery 20 days ago (only in "past"/"all") · a11 name that starts with "=" · a12 surgery today, CT today · a13 surgery in exactly 14 days
//   a14 surgery in 15 days (outside the window) · a15 postponed without a date
import { queryClient } from '../../lib/queryClient'
import { d, mkScan, seed } from '../seed'

const h2 = { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' }
const h3 = { id: 'h3', name: 'אסותא אשדוד' }
const prev = (queryClient.getQueryData(['patient-scans']) as { id: string }[] | undefined) ?? []

const scans = [
  mkScan('a1', 'אברהם ללא סי-טי', { surgery_date: d(3), ct_date: null, ct_time: null, patient_phone: '050-1112233', patient_id_number: '123456782' }),
  mkScan('a2', 'בלה בלי דיסק', { surgery_date: d(5), ct_date: d(-1), scanned: true, disk_collected: false, patient_phone: '052-9998877', patient_id_number: '037372901', health_fund: 'מכבי', insurance: 'הראל' }),
  mkScan('a3', 'גדי CT עבר', { surgery_date: d(9), ct_date: d(-3), scanned: false, hospital_id: 'h2', hospital: h2, procedure_type: 'uni' }),
  mkScan('a4', 'דנה CT בעוד יומיים', { surgery_date: d(6), ct_date: d(2), ct_time: '14:30:00', side: 'שמאל' }),
  mkScan('a5', 'הילה סריקה חוזרת באיחור', { surgery_date: d(12), ct_date: d(-6), scanned: true, disk_collected: true, plan_ready: true, rescan: true, rescan_date: d(-2), rescan_reason: 'איכות סריקה לא תקינה' }),
  mkScan('a6', 'ויקטור סריקה חוזרת בלי תאריך', { surgery_date: d(11), ct_date: d(-8), scanned: true, disk_collected: true, plan_ready: true, rescan: true, rescan_date: null }),
  mkScan('a7', 'זהבה בוטל', { surgery_date: d(4), ct_date: d(-2), status: 'cancelled', notes: 'בוטל מ-26/10/2026: המטופל ויתר\nהערה נוספת' }),
  mkScan('a8', 'שם ארוך מאוד מאוד מאוד של מטופל Mixed English Name 😀 +2.5 עם המון תווים כדי לבדוק גלישה בכרטיס', {
    surgery_date: d(7), ct_date: d(3), patient_phone: '+972-50-1234567', patient_id_number: '000000018', anaesthesia_note: 'מרדים: ד"ר X, 12.8.26 שעה 10:20 — ההערה ארוכה מאוד מאוד מאוד',
    surgeon: { id: 'd4', name: 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס', title: 'ד״ר' }, surgeon_id: 'd4', notes: 'הערה, עם פסיק; ו"מרכאות"',
  }),
  mkScan('a9', 'חנה ירך עם מידות', { surgery_date: d(8), ct_date: d(1), procedure_type: 'hip', side: 'ימין', scanned: true, disk_collected: true, plan_ready: true, implant_data: { head: '36', neck: '+2.5', cup: '54' }, hospital_id: 'h3', hospital: h3 }),
  mkScan('a10', 'טל ניתוח שבוצע', { surgery_date: d(-20), ct_date: d(-30), status: 'done', scanned: true, disk_collected: true, plan_ready: true }),
  mkScan('a11', '=HYPERLINK("http://x","click")', { surgery_date: d(10), ct_date: d(4), notes: '+cmd|calc', patient_phone: '@evil', insurance: '-1+1' }),
  mkScan('a12', 'יונתן הניתוח היום', { surgery_date: d(0), ct_date: d(0), ct_time: '08:00:00' }),
  mkScan('a13', 'כרמית בדיוק בעוד 14 יום', { surgery_date: d(14), ct_date: d(10), scanned: true, disk_collected: true, plan_ready: true }),
  mkScan('a14', 'לאה בעוד 15 יום', { surgery_date: d(15), ct_date: d(12) }),
  mkScan('a15', 'משה ניתוח שנדחה', { surgery_date: null, ct_date: null, ct_time: null, status: 'postponed', notes: 'נדחה מ-24/10/2026: חדר ניתוח תפוס' }),
  mkScan('a16', 'נועה בלי מנתח', { surgery_date: d(13), ct_date: d(5), surgeon_id: null, surgeon: null }),
]

if (new URLSearchParams(window.location.search).has('many')) {
  for (let i = 0; i < 300; i++)
    scans.push(mkScan(`m${i}`, `מטופל ${i} ${'א'.repeat(i % 7)}`, { surgery_date: d(i % 40 - 5), ct_date: i % 5 ? d(i % 17 - 6) : null, scanned: i % 3 === 0, disk_collected: i % 4 === 0, plan_ready: i % 6 === 0, patient_id_number: String(100000000 + i) }))
}

seed(['patient-scans'], [...prev.filter((p) => !scans.some((s) => s.id === p.id)), ...scans])
seed(['mako-hospitals'], [
  { id: 'h1', name: 'שיבא – תל השומר' },
  { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' },
  { id: 'h3', name: 'אסותא אשדוד' },
])

// the implant form: head size narrows the neck sizes (36 has its own list)
const opt = (id: string, category: string, value: string, sort: number, parent_id: string | null = null) => ({ id, category, value, sort, parent_id, created_at: '2026-01-01T00:00:00Z' })
seed(['implant-options'], [
  opt('o1', 'hip_head', '32', 1), opt('o2', 'hip_head', '36', 2), opt('o3', 'hip_head', '40', 3),
  opt('o4', 'hip_neck', '0', 1), opt('o5', 'hip_neck', '+2.5', 2), opt('o6', 'hip_neck', '+5', 3), opt('o7', 'hip_neck', '-2.5', 4),
  opt('o8', 'hip_neck', '0', 1, 'o2'), opt('o9', 'hip_neck', '+2.5', 2, 'o2'),
  opt('o10', 'knee_type', 'CR', 1), opt('o11', 'knee_type', 'PS', 2), opt('o12', 'knee_femur', '3', 1), opt('o13', 'knee_femur', '4', 2),
])
seed(['implant-fields'], null)
