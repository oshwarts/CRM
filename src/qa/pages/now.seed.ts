// Seed of the "urgent now" page (/now). Signed-in user = u-me (the agent role has the same id); his hospital is h1 (base seed).
// ?big=1 adds ~500 more items (tasks, scans, meetings, favourite doctors) for the performance check. Dates are relative to the day the page is opened.
import { d, mkDoctor, mkMeeting, mkScan, mkTask, ts, seed, isEmptyMode } from '../seed'

const big = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('big')
// all page seeds share one query cache and load alphabetically: this one applies only when the tab opens /now, and again after the others' timers
const active = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('path') === '/now'
const queue: (() => void)[] = []
const put = (key: unknown[], value: unknown) => queue.push(() => seed(key, value))

const H1 = { id: 'h1', name: 'שיבא – תל השומר' }
const H2 = { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' }
const link = (h: { id: string; name: string }) => ({ hospital_id: h.id, hospital: { ...h, city: '', sector: 'public' }, role_at_hospital: '', sector: 'public' })
const docRef = (id: string, name: string) => ({ id, name, title: 'ד״ר' })
const done = (id: string, doctorId: string, date: string) => mkMeeting(id, `פגישה ${id}`, date, 'done', { meeting_doctors: [{ doctor: docRef(doctorId, 'x') }] })

// ---- tasks (mine = assignee u-me) ----
const tasks = [
  mkTask('t1', 'להתקשר לד״ר כהן לגבי הצעת מחיר', d(-1), { priority: 'urgent', doctor: docRef('d1', 'יוסי כהן'), hospital: H1 }), // late by 1 day
  mkTask('t2', 'לשלוח דוח מתכלים', d(-10)), // late by 10
  mkTask('t3', 'משימה להיום', d(0)),
  mkTask('t4', 'דחוף להיום — לאשר הזמנה', d(0), { priority: 'urgent' }), // urgent first among today's
  mkTask('t5', 'מחר', d(1)),
  mkTask('t6', 'בעוד שבוע בדיוק', d(7)),
  mkTask('t7', 'בעוד שמונה ימים — לא מופיעה', d(8)),
  mkTask('t8', 'ללא תאריך — לא מופיעה', null),
  mkTask('t9', 'בוצעה — לא מופיעה', d(-3), { is_done: true, status: 'done', done_at: ts(-1) }),
  mkTask('t10', 'של סוכן אחר — לא מופיעה', d(-3), { assignee_id: 'u-agent', assignee: { id: 'u-agent', full_name: 'סוכן בדיקה' } }),
  mkTask('t11', 'משימה עם תיאור ארוך מאוד שנועד לבדוק גלישה — Follow up with the distributor about the +2.5 offset 🦴 and the implant sizes for the next three weeks of surgeries at the hospital', d(-2), { hospital: { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב עם שם ארוך במיוחד כדי לבדוק' } }),
]
const meetings = [
  mkMeeting('m1', 'פגישה שעבר מועדה', d(-4), 'scheduled'),
  mkMeeting('m2', 'פגישת בוקר', d(0), 'scheduled', { meeting_time: '08:30:00' }),
  mkMeeting('m3', 'פגישה בלי שעה', d(0), 'scheduled', { meeting_time: null, meeting_doctors: [], hospital: null }),
  mkMeeting('m4', 'הדגמת רובוט', d(3), 'scheduled', { meeting_time: '14:00:00' }),
  mkMeeting('m5', 'בוצעה — לא מופיעה', d(-2), 'done'),
  mkMeeting('m6', 'בוטלה — לא מופיעה', d(-2), 'cancelled'),
  mkMeeting('m7', 'ללא אחראי (של כולם)', d(1), 'scheduled', { responsible_agent_id: null, responsible_agent: null }),
  mkMeeting('m8', 'של סוכן אחר — לא מופיעה', d(1), 'scheduled', { responsible_agent_id: 'u-agent', responsible_agent: { id: 'u-agent', full_name: 'סוכן בדיקה' } }),
  mkMeeting('m9', '', d(2), 'scheduled', { meeting_doctors: [{ doctor: null }] }), // no subject, doctor object missing
  // meetings that took place: the cadence clock of the favourite doctors
  done('k1', 'f1', d(-40)), done('k2', 'f2', d(-34)), done('k3', 'f3', d(-26)), done('k4', 'f4', d(-5)), done('k5', 'f6', d(-60)),
]
const scans = [
  mkScan('s1', 'ישראל ישראלי', { ct_date: d(0), surgery_date: d(0) }), // CT and surgery today → ONE row
  mkScan('s2', 'דינה כהן', { ct_date: d(-2), scanned: false, surgery_date: d(0), procedure_type: 'hip' }), // CT passed, surgery today → one row, late
  mkScan('s3', 'משה לוי', { ct_date: d(3), surgery_date: d(6) }), // CT in 3 days, surgery in 6 → one row, this week
  mkScan('s4', 'רונית בר-לב', { ct_date: null, surgery_date: d(2), procedure_type: 'uni' }), // surgery in 2 days, no CT date
  mkScan('s5', '', { ct_date: d(-20), scanned: true, disk_collected: true, rescan: true, rescan_date: d(-3) }), // no patient name; re-scan overdue
  mkScan('s6', 'יעל מזרחי', { ct_date: d(-20), scanned: true, disk_collected: true, rescan: true, rescan_date: d(0) }), // re-scan today
  mkScan('s7', 'מבוטל', { ct_date: d(-5), surgery_date: d(0), status: 'cancelled' }), // cancelled → nowhere
  mkScan('s8', 'הכול מוכן', { ct_date: d(-5), scanned: true, disk_collected: true, plan_ready: true, surgery_date: d(3) }), // nothing missing → nowhere
  mkScan('s9', 'Dr. John O\'Neil-Smith patient +2.5 😀 עם שם ארוך מאוד לבדיקת גלישה בשורה', { ct_date: d(1), surgery_date: d(1), hospital: { id: 'h3', name: 'אסותא אשדוד' } }),
]
// ---- doctors: favourites with a cadence (30 days) and potential doctors ----
const fav = (id: string, name: string, o: Record<string, unknown> = {}) => mkDoctor(id, name, 'client', { contact_cadence_days: 30, doctor_hospitals: [link(H1)], ...o })
const doctors = [
  mkDoctor('d1', 'יוסי כהן', 'client', { doctor_hospitals: [link(H1)] }),
  fav('f1', 'אבי לוי'), // last -40 → overdue by 10
  fav('f2', 'בני מזרחי'), // last -34 → overdue by 4
  fav('f3', 'גדי פרידמן'), // last -26 → in 4 days
  fav('f4', 'דני שמש'), // last -5 → fine
  fav('f5', 'הדר ורד', { created_at: `${d(-31)}T08:00:00Z` }), // never met, added 31 days ago → overdue by 1
  fav('f6', 'ורד אביב', { status: 'lost' }), // closed → not chased
  fav('f7', 'זיו ברק', { contact_cadence_days: null }), // no cadence
  mkDoctor('p1', 'סיגל אורן', 'potential', { pipeline_stage: 'יצירת קשר', next_step: 'לקבוע פגישה', next_step_date: d(-4), doctor_hospitals: [link(H1)] }), // late next step (mine by hospital)
  mkDoctor('p2', 'עידו שפירא', 'potential', { pipeline_stage: '', title: 'פרופ׳', created_by: 'u-me' }), // no stage, no step (mine: created)
  mkDoctor('p3', 'פנינה רביב', 'potential', { pipeline_stage: 'הדגמת מוצר', next_step: 'להגיש הצעה', next_step_date: d(6), doctor_hospitals: [link(H1)] }), // long in stage (history)
  mkDoctor('p4', 'קובי עמר', 'potential', { pipeline_stage: '', created_by: 'other', doctor_hospitals: [link(H2)] }), // stuck, but at a hospital that is not mine → admin only
  mkDoctor('p5', 'רונן ביטון', 'potential', { pipeline_stage: 'משא ומתן', next_step: 'להתקשר', next_step_date: d(9), doctor_hospitals: [link(H1)] }), // fine
]
const intel = (id: string, o: Record<string, unknown> = {}) => ({
  id, competitor_id: null, competitor: 'Stryker', product: '', outcome: 'open', loyalty: '', hospital_id: 'h1', doctor_id: null, contract_end: null, tender_due: null, tender_name: '',
  intel_date: d(-20), created_at: ts(-20), created_by: 'u-agent', notes: '', offer: '', loss_reason: '', payment_terms: '', price_per_case: null, implant_price: null, image_paths: [], meeting_id: null, updated_at: ts(-20),
  hospital: H1, doctor: null, ...o,
})
const competitorIntel = [
  intel('i1', { contract_end: d(10), competitor: 'Stryker', doctor: docRef('d1', 'יוסי כהן') }),
  intel('i2', { tender_due: d(5), tender_name: 'מכרז רובוטים ברך 2026', competitor: 'Zimmer Biomet', hospital_id: 'h2', hospital: H2 }), // not my hospital
  intel('i3', { contract_end: d(0), competitor: 'J&J' }),
  intel('i4', { contract_end: d(61) }), // too far
  intel('i5', { contract_end: d(5), outcome: 'won' }), // won → no
  intel('i6', { contract_end: d(-1) }), // passed
  intel('i7', { product: 'Mako 4', created_at: ts(-1), intel_date: d(-1) }), // new activity at my hospital
  intel('i8', { competitor: 'Smith & Nephew', created_at: ts(-2), hospital_id: 'h2', hospital: H2 }), // new activity, not my hospital
  intel('i9', { contract_end: d(20), created_at: ts(-1), created_by: 'u-agent' }), // new AND an alert → once
  intel('i10', { tender_due: d(30), tender_name: '', hospital_id: null, hospital: null, competitor: 'Medacta' }), // no hospital, no tender name
  intel('i11', { created_at: ts(-1), created_by: 'u-me' }), // mine → not "new activity"
]

put(['tasks'], tasks)
put(['meetings'], meetings)
put(['patient-scans'], scans)
put(['doctors'], doctors)
put(['favorites'], ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'])
put(['competitor-intel'], competitorIntel)
put(['hospital-agents'], [{ hospital_id: 'h1', agent_id: 'u-me' }])
put(['stage-history-all'], [
  { doctor_id: 'p3', stage: 'הדגמת מוצר', previous_stage: 'יצירת קשר', changed_at: `${d(-45)}T09:00:00Z` }, // 45 days in the stage
  { doctor_id: 'p5', stage: 'משא ומתן', previous_stage: 'הדגמת מוצר', changed_at: `${d(-2)}T09:00:00Z` },
])
put(['upload-requests'], [
  { id: 'u1', requested_by: 'u-agent', file_name: 'CT-שיבא-מלא.zip', file_size: 180 * 1024 * 1024, purpose: 'תכנון ניתוח', status: 'pending', decided_at: null, decision_note: '', created_at: ts(-1), requester: { full_name: 'סוכן בדיקה' } },
  { id: 'u2', requested_by: 'u-me', file_name: 'scan.zip', file_size: 60 * 1024 * 1024, purpose: '', status: 'approved', decided_at: ts(-1), decision_note: '', created_at: ts(-2), requester: { full_name: 'מנהל בדיקה' } },
  { id: 'u3', requested_by: 'u-me', file_name: 'huge.zip', file_size: 900 * 1024 * 1024, purpose: '', status: 'rejected', decided_at: ts(-2), decision_note: 'גדול מדי — לדחוס', created_at: ts(-3), requester: { full_name: 'מנהל בדיקה' } },
  { id: 'u4', requested_by: 'u-me', file_name: 'old.zip', file_size: 60 * 1024 * 1024, purpose: '', status: 'rejected', decided_at: ts(-9), decision_note: '', created_at: ts(-10), requester: { full_name: 'מנהל בדיקה' } }, // older than a week → hidden
])
put(['procedure-requests'], [
  { id: 'r1', requested_by: 'u-agent', name: 'החלפת כתף הפוכה', parent_id: null, doctor_id: null, note: 'לפי בקשת ד״ר לוי', status: 'pending', decided_at: null, decision_note: '', procedure_id: null, created_at: ts(-1), requester: { full_name: 'סוכן בדיקה' }, doctor: null, parent: { name: 'כתף' } },
  { id: 'r2', requested_by: 'u-me', name: 'GMRS', parent_id: null, doctor_id: null, note: '', status: 'approved', decided_at: ts(-2), decision_note: '', procedure_id: 'p3', created_at: ts(-4), requester: { full_name: 'מנהל בדיקה' }, doctor: null, parent: null },
])
put(['suggestions'], [
  { id: 'g1', created_by: 'u-agent', kind: 'idea', body: 'אפשר להוסיף כפתור התקשרות ישירה מהרשימה של הרופאים, כך שלא צריך לפתוח את הכרטיס בכל פעם בשביל זה', page: '/doctors', status: 'new', dev_note: '', handled_at: null, created_at: ts(-1), author: { full_name: 'סוכן בדיקה', email: 'a@qa.test' } },
  { id: 'g2', created_by: 'u-me', kind: 'problem', body: 'הדף נתקע', page: '/tasks', status: 'done', dev_note: 'תוקן בגרסה האחרונה', handled_at: ts(-3), created_at: ts(-6), author: { full_name: 'מנהל בדיקה', email: 'm@qa.test' } },
])
put(['app-setting', 'backup.last'], isEmptyMode() ? ts(0) : ts(-12)) // the last backup 12 days ago (a string stays in ?empty=1, so then: today)

if (big) {
  put(['tasks'], [...tasks, ...Array.from({ length: 250 }, (_, i) => mkTask(`bt${i}`, `משימה גדולה ${i}`, d((i % 21) - 8)))])
  put(['patient-scans'], [...scans, ...Array.from({ length: 150 }, (_, i) => mkScan(`bs${i}`, `מטופל ${i}`, { ct_date: d((i % 13) - 5), surgery_date: d((i % 11) - 2) }))])
  put(['meetings'], [...meetings, ...Array.from({ length: 100 }, (_, i) => mkMeeting(`bm${i}`, `פגישה ${i}`, d((i % 17) - 6), 'scheduled'))])
}

if (active) {
  const apply = () => queue.forEach((f) => f())
  queueMicrotask(apply)
  setTimeout(apply, 60)
  setTimeout(apply, 800)
  setTimeout(apply, 1500)
}
