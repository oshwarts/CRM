// Home ("/") seed: scans with every alert kind, meetings today / tomorrow / missed / follow-ups, many favourites, awkward names,
// pending sign-ups, a goal, a training, a project with a stuck task. Expected with the default surgery range (a week), signed in as "u-me":
//   scans total 18 · CT this week 3 (sc1, sc11, sc13) · CT passed 2 (sc2, sc18) · surgery without CT 2 (sc3, sc17) · surgery without disk 2 (sc1, sc4)
//   re-scans 4 · meetings today 2 (mt1, unowned mt10) · my tasks 8, 3 overdue (t1, t7, t8) · favourites 12 · doctors to call back (KPI) 5
import { d, mkDoctor, mkMeeting, mkScan, mkTask, qaProfile, seed, ts } from '../seed'

// Every page seed is loaded in every harness page and later files overwrite earlier ones: this one applies itself last (a microtask after all
// modules ran) and only when the harness opens "/", so it neither breaks nor is broken by the seeds of the other screens.
const queued: [unknown[], unknown][] = []
const later = (key: unknown[], value: unknown) => void queued.push([key, value])

const h = { id: 'h1', name: 'שיבא – תל השומר' }
const h2 = { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' }
const h3 = { id: 'h3', name: 'אסותא אשדוד' }
const link = (x: { id: string; name: string }) => ({ hospital_id: x.id, hospital: x, role_at_hospital: '', sector: 'public' })
const old = { created_at: '2025-01-01T00:00:00Z' }

/* ---------- doctors: 12 favourites, one with a very long name, one potential with many hospitals ---------- */
const LONG = 'פרופ׳ רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס — Dr. Alexandra Montgomery-Featherstonehaugh 🦴'
const docs = [
  mkDoctor('hd1', 'יוסי כהן', 'client', { ...old, contact_cadence_days: 30, doctor_hospitals: [link(h)] }),
  mkDoctor('hd2', 'דוד לוי', 'potential', { ...old, title: 'פרופ׳', contact_cadence_days: 14, tracking_notes: 'מתעניין ב-VELYS, לחזור אליו אחרי החג', doctor_hospitals: [link(h2)] }),
  mkDoctor('hd3', 'משה שוחט', 'client', { ...old, phone: '', email: '', position: '', contact_cadence_days: 7, doctor_hospitals: [] }),
  mkDoctor('hd4', LONG, 'potential', { ...old, position: 'מנהל מחלקת אורתופדיה ורופא בכיר לניתוחי החלפת מפרקים', tracking_notes: 'הערה ארוכה מאוד '.repeat(12), doctor_hospitals: [link(h3)] }),
  ...[5, 6, 7, 8, 9, 10, 11, 12].map((n) => mkDoctor(`hd${n}`, `רופא מועדף ${n}`, 'client', { ...old, contact_cadence_days: n < 10 ? 7 : 90, doctor_hospitals: [link(h), link(h2)] })),
  mkDoctor('hd13', 'אסף +2.5 O\'Brien', 'potential', { ...old, doctor_hospitals: [link(h), link(h2), link(h3), link({ id: 'h4', name: 'הדסה' })] }),
  mkDoctor('hd14', 'לא מועדף', 'client', { ...old }),
  mkDoctor('hd15', 'פוטנציאלי 3', 'potential', { ...old }),
  mkDoctor('hd16', 'פוטנציאלי 4', 'potential', { ...old }),
  mkDoctor('hd17', 'פוטנציאלי 5', 'potential', { ...old }),
  mkDoctor('hd18', 'פוטנציאלי 6', 'potential', { ...old }),
]
later(['doctors'], docs)
// &nofav=1: doctors exist but none is a favourite (the empty favourites state with its button)
later(['favorites'], new URLSearchParams(window.location.search).has('nofav') ? [] : ['hd1', 'hd2', 'hd3', 'hd4', 'hd5', 'hd6', 'hd7', 'hd8', 'hd9', 'hd10', 'hd11', 'hd12'])

/* ---------- meetings ---------- */
const md = (id: string, name: string) => ({ doctor: { id, name, title: 'ד״ר' } })
later(['meetings'], [
  mkMeeting('mt1', 'הדגמת רובוט היום', d(0), 'scheduled', { meeting_time: '09:30:00', meeting_doctors: [md('hd5', 'רופא מועדף 5')] }),
  mkMeeting('mt2', 'פגישה של סוכן אחר היום', d(0), 'scheduled', { responsible_agent_id: 'u-agent', responsible_agent: { id: 'u-agent', full_name: 'סוכן בדיקה' }, meeting_doctors: [md('hd6', 'רופא מועדף 6')] }),
  mkMeeting('mt3', 'פגישה מחר עם נושא ארוך מאוד שלא אמור לגלוש מהכרטיס ולא לשבור את השורה ' + 'x'.repeat(40), d(1), 'scheduled', { meeting_time: '14:30:00', location: 'חדר ישיבות 3, קומה 2', meeting_doctors: [md('hd4', LONG), md('hd3', 'משה שוחט')] }),
  mkMeeting('mt4', 'פגישה שהוחמצה לפני 4 ימים', d(-4), 'scheduled', { meeting_doctors: [md('hd7', 'רופא מועדף 7')] }),
  mkMeeting('mt5', '', d(-1), 'scheduled', { meeting_doctors: [], hospital: null, hospital_id: null }),
  mkMeeting('mt6', 'סיכום עם מעקב באיחור', d(-10), 'done', { next_followup_date: d(-1), meeting_doctors: [md('hd1', 'יוסי כהן')] }),
  mkMeeting('mt7', 'פגישה שהתקיימה, מעקב בעוד 5 ימים', d(-10), 'done', { next_followup_date: d(5), meeting_doctors: [md('hd2', 'דוד לוי')] }),
  mkMeeting('mt8', 'פגישה שבוטלה היום', d(0), 'cancelled', {}),
  mkMeeting('mt9', 'פגישה בעוד 5 ימים (אני משתתף)', d(5), 'scheduled', { responsible_agent_id: 'u-agent', responsible_agent: { id: 'u-agent', full_name: 'סוכן בדיקה' }, meeting_agents: [{ agent: { id: 'u-me', full_name: 'מנהל בדיקה' } }], meeting_doctors: [md('hd8', 'רופא מועדף 8')] }),
  mkMeeting('mt10', 'פגישה בלי אחראי היום', d(0), 'scheduled', { responsible_agent_id: null, responsible_agent: null, meeting_doctors: [md('hd9', 'רופא מועדף 9')] }),
  mkMeeting('mt11', 'פגישה בלי תאריך, עם מעקב', null as never, 'needs_followup', { next_followup_date: d(2), meeting_doctors: [md('hd10', 'רופא מועדף 10')] }),
  mkMeeting('mt12', 'פגישה שהתקיימה בעבר', d(-40), 'done', { meeting_doctors: [md('hd11', 'רופא מועדף 11')] }),
  mkMeeting('mt13', 'פגישה אחרונה אתמול', d(-1), 'done', { meeting_doctors: [md('hd12', 'רופא מועדף 12')] }),
])

/* ---------- scans: every alert kind ---------- */
const sc = (id: string, name: string, o: Record<string, unknown> = {}) => mkScan(id, name, { surgery_date: null, ct_date: null, ...o })
later(['patient-scans'], [
  sc('sc1', 'CT בקרוב', { ct_date: d(2), surgery_date: d(5) }),
  sc('sc2', 'CT באיחור', { ct_date: d(-3), surgery_date: d(10) }),
  sc('sc3', 'ניתוח בלי CT', { surgery_date: d(3), hospital_id: 'h2', hospital: h2 }),
  sc('sc4', 'חסר דיסק', { ct_date: d(-1), scanned: true, disk_collected: false, plan_ready: true, surgery_date: d(2), hospital_id: 'h2', hospital: h2 }),
  sc('sc5', 'סריקה חוזרת היום', { rescan: true, rescan_date: d(0), rescan_reason: 'איכות תמונה', hospital_id: 'h2', hospital: h2 }),
  sc('sc6', 'סריקה חוזרת באיחור', { rescan: true, rescan_date: d(-2), rescan_reason: 'תזוזה בזמן הסריקה' }),
  sc('sc7', 'סריקה חוזרת בלי תאריך', { rescan: true }),
  sc('sc8', 'סריקה חוזרת בעוד 4 ימים', { rescan: true, rescan_date: d(4), hospital_id: 'h3', hospital: h3 }),
  sc('sc9', 'סריקה חוזרת שבוצעה', { rescan: true, rescan_date: d(1), rescan_done: true }),
  sc('sc10', 'מבוטל', { status: 'cancelled', surgery_date: d(1), ct_date: d(-2) }),
  sc('sc11', 'ניתוח היום · CT היום (ארוך מאוד מאוד מאוד מאוד מאוד מאוד מאוד מאוד מאוד מאוד מאוד Mixed English)', { ct_date: d(0), surgery_date: d(0), hospital_id: 'h3', hospital: h3, plan_ready: true, disk_collected: true }),
  sc('sc12', 'ניתוח בעוד 12 יום', { surgery_date: d(12) }),
  sc('sc13', 'CT בעוד 7 ימים (גבול)', { ct_date: d(7), surgery_date: d(20) }),
  sc('sc14', 'CT בעוד 8 ימים (מחוץ לחלון)', { ct_date: d(8) }),
  sc('sc15', 'הכול מוכן', { ct_date: d(-5), scanned: true, disk_collected: true, plan_ready: true, surgery_date: d(20) }),
  sc('sc16', 'ניתוח אחרי 40 יום', { surgery_date: d(40), hospital_id: 'h3', hospital: h3 }),
  sc('sc17', 'ניתוח מחר בלי CT', { surgery_date: d(1), hospital_id: 'h3', hospital: h3, ct_date: null }),
  sc('sc18', 'CT אתמול טרם נסרק 🦴', { ct_date: d(-1) }),
])

/* ---------- tasks (open, mine) incl. > 6 needing attention ---------- */
later(['tasks'], [
  mkTask('t1', 'להתקשר לד״ר כהן לגבי הצעת מחיר באיחור של יומיים', d(-2), { priority: 'urgent' }),
  mkTask('t2', 'לשלוח דוח מתכלים היום', d(0)),
  mkTask('t3', 'משימה מחר', d(1)),
  mkTask('t4', 'משימה בעוד 3 ימים (גבול)', d(3)),
  mkTask('t5', 'משימה בעוד 4 ימים (לא מוצגת)', d(4)),
  mkTask('t6', 'דחופה בלי תאריך', null, { priority: 'urgent' }),
  mkTask('t7', 'ארוכה מאוד '.repeat(15), d(-1)),
  mkTask('t8', 'שמינית — תופיע ב"ועוד"', d(-5)),
  mkTask('t9', 'של סוכן אחר, באיחור', d(-5), { assignee_id: 'u-agent', assignee: { id: 'u-agent', full_name: 'סוכן בדיקה' } }),
  mkTask('t10', 'בוצעה', d(-1), { is_done: true, status: 'done', done_at: ts(-1) }),
  mkTask('t11', 'בפרויקט — תקועה', d(-3), { status: 'blocked', project_id: 'pr1', external_owner: '', assignee_id: 'u-agent', assignee: { id: 'u-agent', full_name: 'סוכן בדיקה' } }),
  mkTask('t12', 'בפרויקט — בוצעה', d(-3), { status: 'done', is_done: true, done_at: ts(-1), project_id: 'pr1', external_owner: '' }),
])

/* ---------- pending sign-ups (managers), goals, training, project ---------- */
const pend = (id: string, name: string, email: string) => ({ ...(qaProfile('agent') as object), id, full_name: name, email, active: false, status_changed_at: null })
later(['all-users'], [qaProfile('admin'), { ...(qaProfile('agent') as object), id: 'u-agent' }, pend('u-p1', 'נרשם חדש עם שם ארוך מאוד מאוד מאוד מאוד מאוד', 'new1@qa.test'), pend('u-p2', '', 'only-email@qa.test'), { ...pend('u-p3', 'נדחה', 'x@qa.test'), status_changed_at: ts(-3) }])
later(['agent-goals'], [
  { id: 'g1', agent_id: 'u-me', category: 'activity', metric: 'meetings_held', title: 'פגישות החודש', target: 5, current_value: 0, progress_pct: 0, unit: '', notes: '', period_start: d(-10), period_end: d(20), created_at: ts(-12), updated_at: ts(-12), created_by: 'u-me' },
  { id: 'g2', agent_id: 'u-agent', category: 'sales', metric: 'manual', title: 'של סוכן אחר', target: 3, current_value: 1, progress_pct: 0, unit: '', notes: '', period_start: d(-10), period_end: d(20), created_at: ts(-12), updated_at: ts(-12), created_by: 'u-me' },
  { id: 'g3', agent_id: 'u-me', category: 'activity', metric: 'manual', title: 'יעד שפג', target: 3, current_value: 1, progress_pct: 0, unit: '', notes: '', period_start: d(-60), period_end: d(-30), created_at: ts(-62), updated_at: ts(-62), created_by: 'u-me' },
])
later(['training-stages'], [
  { id: 'ts1', procedure_id: null, name: 'היכרות עם המערכת', required_count: 2, sort: 0, created_at: ts(-100) },
  { id: 'ts2', procedure_id: null, name: 'ליווי ניתוח ראשון בליווי מדריך', required_count: 3, sort: 1, created_at: ts(-100) },
])
later(['agent-training'], [
  { id: 'at1', agent_id: 'u-me', stage_id: 'ts1', completed_on: d(-5), notes: '', file_name: '', file_path: null, created_at: ts(-5), created_by: 'u-me' },
  { id: 'at2', agent_id: 'u-me', stage_id: 'ts1', completed_on: d(-3), notes: '', file_name: '', file_path: null, created_at: ts(-3), created_by: 'u-me' },
  { id: 'at3', agent_id: 'u-me', stage_id: 'ts2', completed_on: d(-1), notes: '', file_name: '', file_path: null, created_at: ts(-1), created_by: 'u-me' },
])
later(['projects'], [
  { id: 'pr1', name: 'אינטגרציית MAKO באיכילוב', description: '', hospital_id: 'h2', owner_id: 'u-me', status: 'active', start_date: d(-30), target_date: d(30), template_key: '', created_at: ts(-30), updated_at: ts(-1), hospital: h2, owner: { id: 'u-me', full_name: 'מנהל בדיקה' }, areas: [] },
  { id: 'pr2', name: 'פרויקט מוקפא', description: '', hospital_id: null, owner_id: 'u-me', status: 'on_hold', start_date: null, target_date: null, template_key: '', created_at: ts(-30), updated_at: ts(-1), hospital: null, owner: null, areas: [] },
])
later(['all-favorites'], [])
later(['all-counts'], [])
later(['map-data'], [])

if ((new URLSearchParams(window.location.search).get('path') ?? '/') === '/') {
  const apply = () => queued.forEach(([k, v]) => seed(k, v))
  queueMicrotask(apply)
  // other page seeds add their rows to the shared lists in a timeout (doctor-profile.seed.ts): this screen's counts must be its own
  setTimeout(apply, 60)
  setTimeout(apply, 800)
}
