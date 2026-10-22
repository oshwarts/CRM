// Seed of the doctors list (/doctors): 60 doctors across statuses, stages, cadences, awkward names and missing fields.
// ?big=1 adds 440 more (500 in all) for the performance check. Today in the comments = the day the page is opened.
import { d, mkDoctor, mkMeeting, mkScan, seed } from '../seed'
import { PIPELINE_STAGES } from '../../lib/types'

const big = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('big')

// The seeds of all pages share one query cache and load alphabetically: another page's seed of ['meetings'] / ['procedures'] would
// win over this one. So this seed is applied only when the tab opens the doctors list itself, and again after the other seeds' timers.
const active = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('path') === '/doctors'
const queue: (() => void)[] = []
const put = (key: unknown[], value: unknown) => queue.push(() => seed(key, value))

const H = {
  h1: { id: 'h1', name: 'שיבא – תל השומר' },
  h2: { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' },
  h3: { id: 'h3', name: 'אסותא אשדוד' },
}
const link = (h: { id: string; name: string }) => ({ hospital_id: h.id, hospital: { ...h, city: '', sector: 'public' }, role_at_hospital: '', sector: 'public' })
const procs = (...ids: string[]) => ids.map((procedure_id) => ({ procedure_id }))
const full = { doctor_hospitals: [link(H.h1)], doctor_procedures: procs('p1') }

/** a meeting of the doctor (status done = it took place) */
const mt = (id: string, docId: string, date: string, status: 'scheduled' | 'done' | 'cancelled' | 'needs_followup') =>
  mkMeeting(id, `פגישה ${id}`, date, status, { meeting_doctors: [{ doctor: { id: docId, name: 'x', title: 'ד״ר' } }] })

const doctors = [
  // ---- clients with a cadence (30 days) ----
  mkDoctor('c1', 'אבי כהן', 'client', { ...full, contact_cadence_days: 30, doctor_robotic_systems: [{ system_id: 's1' }], doctor_companies: [{ company_id: 'co1' }] }), // last done -40 → DUE 10 days
  mkDoctor('c2', 'בני לוי', 'client', { ...full, contact_cadence_days: 30 }), // last done -20 → ok
  mkDoctor('c3', 'גדי מזרחי', 'client', { ...full, contact_cadence_days: 30 }), // last done -25 → SOON (5)
  mkDoctor('c4', 'דני פרידמן', 'client', { ...full, contact_cadence_days: 30 }), // last done -40 but scheduled in +3 → no alert
  mkDoctor('c5', 'הדר שמש', 'client', { ...full, contact_cadence_days: 14, created_at: '2026-01-01T00:00:00Z' }), // only an unclosed past "scheduled" → not contact → DUE since creation
  mkDoctor('c6', 'ורד אביב', 'client', { ...full, contact_cadence_days: 7, created_at: `${d(-3)}T08:00:00Z` }), // never met, created 3 days ago → soon (4)
  // ---- clients without a cadence ----
  mkDoctor('c7', 'זיו ברק', 'client', full), // last done -70 → STALE
  mkDoctor('c8', 'חיים דהן', 'client', full), // last done -10 → fine
  mkDoctor('c9', 'טל גולן', 'client', full), // never met → STALE "עוד לא נפגשנו"
  mkDoctor('c10', 'יובל נחום', 'client', full), // only a cancelled meeting → STALE never met
  mkDoctor('c11', 'כרמל אשכנזי', 'client', full), // last done -100, scheduled +5 → no alert, "פגישה הבאה"
  mkDoctor('c12', 'לירון פז', 'client', full), // met today
  mkDoctor('c13', 'מאיר אזולאי', 'client', full), // needs_followup -59 → 59 days → fine (< 60)
  mkDoctor('c14', 'נועם רוזן', 'client', full), // needs_followup -60 → stale (boundary)
  // ---- potential ----
  mkDoctor('p1', 'סיגל אורן', 'potential', { ...full, pipeline_stage: 'יצירת קשר', next_step: 'לקבוע פגישת היכרות', next_step_date: d(-4) }), // overdue next step
  mkDoctor('p2', 'עידו שפירא', 'potential', { ...full, pipeline_stage: '', title: 'פרופ׳' }), // no stage, no next step
  mkDoctor('p3', 'פנינה רביב', 'potential', { ...full, pipeline_stage: 'הדגמת מוצר', next_step_date: d(6) }), // date only
  mkDoctor('p4', 'צביקה הרשקוביץ', 'potential', { ...full, pipeline_stage: 'משא ומתן', next_step: 'להגיש הצעת מחיר', next_step_date: d(2) }),
  mkDoctor('p5', 'קובי עמר', 'potential', { ...full, pipeline_stage: 'ניתוח ניסיון', next_step: 'ללוות ניתוח ראשון' }),
  mkDoctor('p6', 'רונן ביטון', 'potential', { ...full, pipeline_stage: 'שלב שנמחק מההגדרות' }), // a stage that is not in the list any more
  mkDoctor('p7', 'שרון אילן', 'potential', { ...full, pipeline_stage: 'זיהוי ראשוני', contact_cadence_days: 60 }),
  // ---- lost ----
  mkDoctor('l1', 'תמיר סגל', 'lost', { ...full, lost_reason: 'עבר למתחרה', lost_at: d(-30) }),
  mkDoctor('l2', 'אורית דיין', 'lost', { doctor_hospitals: [], lost_reason: '', lost_at: d(-3) }),
  // ---- awkward names / fields ----
  mkDoctor('a1', 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס של שמונים תווים', 'client', {
    ...full, position: 'מנהל המחלקה האורתופדית ומרכז הרובוטיקה הניתוחית ויו״ר ועדת המכשור הרפואי הארצית', doctor_hospitals: [link(H.h1), link(H.h2), link(H.h3)],
  }),
  mkDoctor('a2', 'Dr. John O\'Neil-Smith (ג\'ון)', 'client', { ...full, title: 'Prof.', phone: '+972-52-123-4567', position: 'Head of Ortho' }),
  mkDoctor('a3', '😀 דני 🦴', 'potential', { ...full, pipeline_stage: 'פגישת היכרות', phone: '(054) 123 4567' }),
  mkDoctor('a4', '+2.5 דוד', 'client', { ...full, phone: '03-5551234' }),
  mkDoctor('a5', 'כֹּהֵן אֲבִיעֵזֶר', 'client', { ...full, phone: '972521234567' }), // niqqud
  mkDoctor('a6', 'עמוס בר־לב', 'client', { ...full, phone: '052 123 4567 ext 5' }),
  mkDoctor('a7', 'יעקב ג׳ונסון', 'client', { ...full, phone: '+9725012345678' }),
  mkDoctor('a8', 'אבי "הגדול" לוי', 'client', { ...full, phone: '0501234567', email: 'x@y.co' }),
  mkDoctor('a9', 'בלי שום פרט', 'client', { phone: '', position: '', doctor_hospitals: [], doctor_procedures: [], email: '' }), // missing: phone, hospital, procedures
  mkDoctor('a10', '=SUM(A1) נוסחה', 'client', { ...full, position: '@cmd' }), // csv formula injection
  mkDoctor('a11', 'רופא עם הרבה קשרים', 'client', {
    ...full, doctor_companies: [{ company_id: 'co1' }, { company_id: 'co2' }], doctor_robotic_systems: [{ system_id: 's1' }, { system_id: 's2' }], contact_cadence_days: 45, // 45 is not in the select
  }),
  mkDoctor('a12', 'מרים (דר) חנוכה', 'client', { ...full, doctor_procedures: procs('p3a') }), // a sub-procedure of GMRS
  mkDoctor('a13', 'אלי', 'client', { ...full, title: '' }), // no title
]

// 25 more, plain, in alphabetical-ish order, to reach 60 (and so a second page of cards)
const fillers = Array.from({ length: 25 }, (_, i) => mkDoctor(`f${i + 1}`, `רופא מילוי ${String(i + 1).padStart(2, '0')}`, i % 5 === 0 ? 'potential' : 'client', { ...full, ...(i % 5 === 0 ? { pipeline_stage: 'זיהוי ראשוני' } : {}), phone: i % 3 === 0 ? '' : '050-7654321' }))

const bigOnes = big
  ? Array.from({ length: 440 }, (_, i) => mkDoctor(`b${i + 1}`, `רופא ענק ${String(i + 1).padStart(3, '0')}`, i % 4 === 0 ? 'potential' : 'client', { ...full, contact_cadence_days: i % 3 === 0 ? 30 : null, pipeline_stage: i % 4 === 0 ? 'יצירת קשר' : '' }))
  : []

put(['doctors'], [...doctors, ...fillers, ...bigOnes])

put(['meetings'], [
  mt('m1', 'c1', d(-40), 'done'),
  mt('m2', 'c2', d(-20), 'done'),
  mt('m3', 'c3', d(-25), 'done'),
  mt('m4', 'c4', d(-40), 'done'),
  mt('m4b', 'c4', d(3), 'scheduled'),
  mt('m5', 'c5', d(-10), 'scheduled'), // never closed
  mt('m7', 'c7', d(-70), 'done'),
  mt('m8', 'c8', d(-10), 'done'),
  mt('m10', 'c10', d(-5), 'cancelled'),
  mt('m11', 'c11', d(-100), 'done'),
  mt('m11b', 'c11', d(5), 'scheduled'),
  mt('m12', 'c12', d(0), 'done'),
  mt('m13', 'c13', d(-59), 'needs_followup'),
  mt('m14', 'c14', d(-60), 'needs_followup'),
  mt('m15', 'p1', d(-8), 'done'),
  mt('m16', 'a1', d(-300), 'done'),
  // a meeting for an unknown doctor object (null) must not crash
  mkMeeting('m99', 'פגישה בלי רופא', d(-1), 'done', { meeting_doctors: [{ doctor: null }] }),
])

// surgeries: window default 90 days
put(['patient-scans'], [
  mkScan('sc1', 'מטופל א', { surgeon_id: 'c1', surgery_date: d(-10), status: 'done' }),
  mkScan('sc2', 'מטופל ב', { surgeon_id: 'c1', surgery_date: d(-80), status: 'done' }),
  mkScan('sc3', 'מטופל ג', { surgeon_id: 'c1', surgery_date: d(-120), status: 'done' }), // outside 90, inside 180
  mkScan('sc4', 'מטופל ד', { surgeon_id: 'c1', surgery_date: d(-5), status: 'cancelled' }), // not counted
  mkScan('sc5', 'מטופל ה', { surgeon_id: 'c1', surgery_date: d(7), status: 'planned' }), // future: not counted
  mkScan('sc6', 'מטופל ו', { surgeon_id: 'c2', surgery_date: d(-1), status: 'done' }),
  mkScan('sc7', 'מטופל ז', { surgeon_id: null, surgery_date: d(-1), status: 'done' }),
  mkScan('sc8', 'מטופל ח', { surgeon_id: 'c3', surgery_date: null, status: 'planned' }),
])
put(['planned-surgeries'], [
  { id: 'ps1', surgery_date: d(-3), surgery_time: null, doctor_id: 'c1', hospital_id: 'h1', procedure: 'ברך', company: '', notes: '', cases: 3, agent_id: 'u-me', status: 'done', created_by: 'u-me', doctor: null, hospital: null, agent: null },
  { id: 'ps2', surgery_date: d(-3), surgery_time: null, doctor_id: 'c1', hospital_id: 'h1', procedure: 'ברך', company: '', notes: '', cases: 9, agent_id: 'u-me', status: 'cancelled', created_by: 'u-me', doctor: null, hospital: null, agent: null },
  { id: 'ps3', surgery_date: d(-2), surgery_time: null, doctor_id: 'c3', hospital_id: 'h1', procedure: 'ירך', company: '', notes: '', cases: 0, agent_id: 'u-me', status: 'done', created_by: 'u-me', doctor: null, hospital: null, agent: null }, // cases 0 → counts 0 (?? only for null)
])
// c1 → 1 (sc1) + 1 (sc2) + 3 = 5 in 90 days (6 with sc3 in 180). c2 → 1. c3 → 0.

put(['competitor-intel'], [
  { id: 'i1', doctor_id: 'c1', loyalty: 'loyal', intel_date: d(-2), doctor: null, hospital: null },
  { id: 'i2', doctor_id: 'c1', loyalty: 'open', intel_date: d(-30), doctor: null, hospital: null }, // older: the newest wins → loyal
  { id: 'i3', doctor_id: 'c2', loyalty: 'leaning', intel_date: d(-5), doctor: null, hospital: null },
  { id: 'i4', doctor_id: 'c3', loyalty: 'open', intel_date: d(-5), doctor: null, hospital: null },
  { id: 'i5', doctor_id: 'c4', loyalty: '', intel_date: d(-5), doctor: null, hospital: null },
  { id: 'i6', doctor_id: null, loyalty: 'loyal', intel_date: d(-5), doctor: null, hospital: null },
])

put(['procedures'], [
  { id: 'p1', name: 'החלפת ברך', category: 'knee', parent_id: null },
  { id: 'p2', name: 'החלפת ירך', category: 'hip', parent_id: null },
  { id: 'p3', name: 'GMRS', category: 'other', parent_id: null },
  { id: 'p3a', name: 'גידולים', category: 'other', parent_id: 'p3' },
  { id: 'p3b', name: 'שחזור', category: 'other', parent_id: 'p3' },
])
put(['pipeline-doctors'], [
  { id: 'p1', case_volumes: [{ year: new Date().getFullYear(), count: 4, company: null, procedure: null, hospital: null }, { year: new Date().getFullYear() - 1, count: 20, company: null, procedure: null, hospital: null }] },
  { id: 'p4', case_volumes: [{ year: new Date().getFullYear(), count: 2, company: null, procedure: null, hospital: null }, { year: new Date().getFullYear(), count: 3, company: null, procedure: null, hospital: null }] },
  { id: 'p2', case_volumes: [] },
])
put(['pipeline-stages'], PIPELINE_STAGES.map((name, i) => ({ id: `st${i}`, name, sort: i, is_won: i === PIPELINE_STAGES.length - 1, suggested_step: '', stuck_days: null })))
// a saved contact (for the "this number is already saved" hint of the import)
put(['contacts'], [{ id: 'ct1', name: 'דנה מלוגיסטיקה', role: 'מתאמת', phone: '052-5550000', email: '', doctor_id: null, hospital_id: null }])
put(['stage-since'], new Map([
  ['p1', { stage: 'יצירת קשר', since: d(-12) }],
  ['p4', { stage: 'משא ומתן', since: d(-1) }],
]))

if (active) {
  const apply = () => queue.forEach((f) => f())
  queueMicrotask(apply)
  // other pages' seeds add / replace rows of the shared lists in timers (doctor-profile at 700 ms, tasks at 400 ms): the counts of this screen must be its own
  setTimeout(apply, 60)
  setTimeout(apply, 800)
}
