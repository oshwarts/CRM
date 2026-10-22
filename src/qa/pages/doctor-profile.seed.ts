// QA data of the doctor profile (/doctors/:id): d1 rich client, d2 potential in the funnel, d3 bare client, d5 lost, d6 awkward text, d7 no data at all.
import { d, mkDoctor, mkHospital, mkMeeting, mkTask, seed, ts } from '../seed'
import { queryClient } from '../../lib/queryClient'

/** adds rows to a list other pages seed too: a row with the same id stays as it is (`override`: this file's row wins), the base data is never wiped */
function addTo(key: unknown[], rows: object[], override = false) {
  // after every other page seed has run (they replace the shared lists), so that our rows are not lost
  setTimeout(() => {
    const mine = rows as { id: string }[]
    const cur = queryClient.getQueryData<{ id: string }[]>(key) ?? []
    const keep = override ? cur.filter((x) => !mine.some((r) => r.id === x.id)) : cur
    seed(key, [...keep, ...mine.filter((r) => override || !cur.some((x) => x.id === r.id))])
  }, 700) // the tasks page seed replaces the shared lists at 400 ms
}

const h1 = mkHospital('h1', 'שיבא – תל השומר', { city: 'רמת גן', lat: 32.045, lng: 34.844, hospital_robotic_systems: [{ system_id: 's1' }] })
const h2 = mkHospital('h2', 'איכילוב – מרכז רפואי תל אביב', { hospital_robotic_systems: [{ system_id: 's2' }] })
const org = null
const link = (h: { id: string }, o: Record<string, unknown> = {}) => ({
  doctor_id: 'd1', hospital_id: h.id, role_at_hospital: 'מנהל יחידה', sector: 'public', clinic_days: [], clinic_hours: '', clinic_note: '', hospital: { ...h, organization: org }, ...o,
})
const co = { id: 'co1', name: 'Ami Technologies' }
const sys = { id: 's1', name: 'Mako' }

const procs = [
  { id: 'p1', name: 'החלפת ברך', category: 'knee', parent_id: null, planning_template: 'mako_tka' },
  { id: 'p2', name: 'החלפת ירך', category: 'hip', parent_id: null, planning_template: 'mako_tha' },
  { id: 'p3', name: 'יוני', category: 'knee', parent_id: null, planning_template: 'mako_pka' },
  { id: 'p4', name: 'כתף', category: 'shoulder', parent_id: null, planning_template: 'generic' },
]
addTo(['procedures'], procs, true)

const planTka = {
  id: 'pl1', doctor_id: 'd1', procedure_id: 'p1', procedure: procs[0], surgeon_preferences: '', surgical_approach: '', required_equipment: 'מסור נוסף + 2 להבים',
  plan_data: { implant_system: 'Triathlon CR', patella: 'Resurface', alignment: 'Kinematic', fem_coronal: '2.5', fem_distal_l: '9', tib_slope: '3', tib_coronal: '-1.5', surgeon_notes: 'שורה ראשונה\nשורה שניה +2.5' },
  created_at: ts(-30), updated_at: ts(-30),
}
const planLegacy = {
  id: 'pl2', doctor_id: 'd1', procedure_id: 'p4', procedure: procs[3], surgeon_preferences: 'מעדיף גישה קדמית', surgical_approach: 'Deltopectoral', required_equipment: '',
  plan_data: {}, created_at: ts(-20), updated_at: ts(-20),
}
const planEmpty = { id: 'pl3', doctor_id: 'd1', procedure_id: 'p2', procedure: procs[1], surgeon_preferences: '', surgical_approach: '', required_equipment: '', plan_data: {}, created_at: ts(-10), updated_at: ts(-10) }

const d1 = mkDoctor('d1', 'יוסי כהן', 'client', {
  position: 'מנהל יחידת ברך', contact_cadence_days: 30,
  notes: 'הערה כללית\nשורה שניה עם English mixed, ‏+2.5 ו-emoji 🙂',
  tracking_notes: 'מעקב: ביקש הדגמה נוספת.',
  doctor_companies: [{ company: co }, { company: { id: 'co2', name: 'J&J' } }],
  doctor_procedures: [{ procedure: procs[0] }, { procedure: procs[1] }],
  doctor_robotic_systems: [{ system: sys }],
  doctor_hospitals: [
    link(h1, { clinic_days: [0, 2, 4], clinic_hours: '08:00-14:00', clinic_note: 'קבלה בקומה 2' }),
    link(h2, { sector: 'private', role_at_hospital: '' }),
  ],
  doctor_preop_plans: [planTka, planLegacy, planEmpty],
})
const d2 = mkDoctor('d2', 'דוד לוי', 'potential', {
  title: 'פרופ׳', pipeline_stage: 'פגישת היכרות', next_step: 'לקבוע פגישת היכרות', next_step_date: d(-3),
  doctor_hospitals: [link(h2, { doctor_id: 'd2' })],
  doctor_preop_plans: [],
})
const d3 = mkDoctor('d3', 'משה שוחט', 'client', { phone: '', email: '', doctor_preop_plans: [] })
const d5 = mkDoctor('d5', 'רחל אברמוב', 'lost', { pipeline_stage: 'פגישת היכרות', lost_reason: 'עובר לחו״ל', lost_at: d(-20), doctor_preop_plans: [] })
const d6 = mkDoctor('d6', 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס Dr. Alexandria Montgomery-Featherstonehaugh', 'potential', {
  title: 'פרופ׳ חבר', position: 'מנהלת המחלקה האורתופדית ויו״ר האגודה לכירורגיה אורתופדית של ישראל ומרכזת הוועדה',
  notes: 'א'.repeat(300) + ' https://example.com/' + 'x'.repeat(120), tracking_notes: 'LTR text +2.5 עברית 🙂 ' + 'מילה '.repeat(60),
  pipeline_stage: 'שלב שנמחק', next_step: 'צעד הבא ארוך מאוד '.repeat(8), next_step_date: d(5), phone: '+972-50-123-4567', email: 'very.long.email.address.for.overflow.test@subdomain.example-hospital.org.il',
  doctor_hospitals: [link(h1, { doctor_id: 'd6', role_at_hospital: 'תפקיד ארוך מאוד '.repeat(5) }), link(h2, { doctor_id: 'd6' })],
  doctor_companies: [{ company: { id: 'co3', name: 'חברה עם שם ארוך מאוד מאוד לבדיקת גלישה בכותרת' } }],
  doctor_preop_plans: [],
})
const d7 = mkDoctor('d7', 'אין נתונים', 'client', { title: '', position: '', phone: '', email: '', created_by: 'u-agent', doctor_preop_plans: [] })
for (const x of [d1, d2, d3, d5, d6, d7]) seed(['doctor', x.id], x)

addTo(['doctors'], [d1, d2, d3, d5, d6, d7])

const mk = (id: string, subject: string, date: string | null, status: 'scheduled' | 'done' | 'cancelled' | 'needs_followup', o = {}) => mkMeeting(id, subject, date as string, status, o)
seed(['doctor-meetings', 'd1'], [
  mk('dpm2', 'הדגמת רובוט', d(2), 'scheduled', { next_followup_date: d(9) }),
  mk('dpm1', 'פגישת היכרות', d(-3), 'done', { summary: 'סיכום הפגישה' }),
  mk('dpm4', '', d(-100), 'cancelled'),
  mk('dpm5', 'פגישה בלי תאריך', null, 'needs_followup'),
])
seed(['doctor-meetings', 'd2'], [mk('dpm6', 'שיחת היכרות', d(-120), 'done', { meeting_doctors: [{ doctor: { id: 'd2', name: 'דוד לוי', title: 'פרופ׳' } }] })])
for (const id of ['d3', 'd5', 'd6', 'd7']) seed(['doctor-meetings', id], [])
addTo(['meetings'], [
  mk('dpm1', 'פגישת היכרות', d(-3), 'done', { summary: 'סיכום הפגישה '.repeat(30) }),
  mk('dpm2', 'הדגמת רובוט', d(2), 'scheduled'),
  mk('dpm4', '', d(-100), 'cancelled'),
])
addTo(['tasks'], [
  mkTask('dpt3', 'משימה חוזרת שבועית', d(0), { recurrence: 'weekly', doctor_id: 'd1', subtasks: [{ id: 'st1', is_done: true }, { id: 'st2', is_done: false }] }),
  mkTask('dpt5', 'בוצעה', d(-1), { is_done: true, status: 'done', done_at: ts(-1), doctor_id: 'd1' }),
  mkTask('dpt6', 'משימה של סוכן אחר', d(1), { assignee_id: 'u-agent', assignee: { id: 'u-agent', full_name: 'סוכן בדיקה' }, doctor_id: 'd1' }),
  mkTask('dpt7', 'ללא תאריך', null, { doctor_id: 'd2' }),
])

/* equipment & picking list */
const items = [
  { id: 'e1', name: 'מגש מכשירים ברך', catalog_number: 'KN-100', company_id: 'co1', company: co, image_path: '', images: [], parts: [], created_at: ts(-100) },
  { id: 'e2', name: 'שתל פמורלי', catalog_number: 'FM-22', company_id: 'co1', company: co, image_path: '', images: [], parts: [{ id: 'pt1', part_number: 'FM-22-A', name: 'חלק א' }], created_at: ts(-100) },
  { id: 'e3', name: 'להב מסור', catalog_number: '', company_id: null, company: null, image_path: 'x.png', images: [], parts: [], created_at: ts(-100) },
  { id: 'e4', name: 'כיסוי סטרילי', catalog_number: 'ST-9', company_id: 'co2', company: { id: 'co2', name: 'J&J' }, image_path: '', images: [], parts: [], created_at: ts(-100) },
]
seed(['equipment-items'], items)
seed(['doctor-equipment', 'd1'], [
  { id: 'q1', doctor_id: 'd1', procedure_id: 'p1', item_id: 'e1', qty_per_case: 1, scales_with_cases: false, procedure: { id: 'p1', name: 'החלפת ברך' }, item: items[0], created_at: ts(-9) },
  { id: 'q2', doctor_id: 'd1', procedure_id: 'p1', item_id: 'e2', qty_per_case: 2, scales_with_cases: true, procedure: { id: 'p1', name: 'החלפת ברך' }, item: items[1], created_at: ts(-9) },
  { id: 'q3', doctor_id: 'd1', procedure_id: 'p2', item_id: 'e2', qty_per_case: 1, scales_with_cases: true, procedure: { id: 'p2', name: 'החלפת ירך' }, item: items[1], created_at: ts(-9) },
  { id: 'q4', doctor_id: 'd1', procedure_id: 'p2', item_id: 'e3', qty_per_case: 3, scales_with_cases: true, procedure: { id: 'p2', name: 'החלפת ירך' }, item: items[2], created_at: ts(-9) },
])
for (const id of ['d2', 'd3', 'd5', 'd6', 'd7']) seed(['doctor-equipment', id], [])

/* surgical course */
seed(['doctor-courses', 'd1'], [{
  id: 'c1', doctor_id: 'd1', procedure_id: 'p1', procedure: { id: 'p1', name: 'החלפת ברך' }, created_at: ts(-8), updated_at: ts(-8),
  stages: [
    { id: 'cs1', course_id: 'c1', sort: 1, title: 'הכנה', items: [{ id: 'ci1', stage_id: 'cs1', sort: 1, text: 'לחטא את האזור' }, { id: 'ci2', stage_id: 'cs1', sort: 2, text: 'שורה ארוכה '.repeat(20) }] },
    { id: 'cs2', course_id: 'c1', sort: 2, title: 'חיתוך', items: [] },
  ],
}, {
  id: 'c2', doctor_id: 'd1', procedure_id: 'p2', procedure: { id: 'p2', name: 'החלפת ירך' }, created_at: ts(-7), updated_at: ts(-7), stages: [],
}])
for (const id of ['d2', 'd3', 'd5', 'd6', 'd7']) seed(['doctor-courses', id], [])

/* clinics, volumes, funnel */
seed(['private-clinics', 'd1'], [{ id: 'pc1', doctor_id: 'd1', address: 'הרצל 12, תל אביב', clinic_days: [1, 3], created_at: ts(-5) }, { id: 'pc2', doctor_id: 'd1', address: '', clinic_days: [], created_at: ts(-4) }])
for (const id of ['d2', 'd3', 'd5', 'd6', 'd7']) seed(['private-clinics', id], [])
seed(['case-volumes', 'd1', null], [
  { id: 'cv1', doctor_id: 'd1', hospital_id: 'h1', procedure_id: 'p1', company_id: 'co1', year: new Date().getFullYear(), count: 120, doctor: null, hospital: { id: 'h1', name: 'שיבא – תל השומר', city: 'רמת גן' }, procedure: { id: 'p1', name: 'החלפת ברך', category: 'knee' }, company: co },
])
seed(['done-scan-counts'], [])
seed(['pipeline-stages'], ['זיהוי ראשוני', 'יצירת קשר', 'פגישת היכרות', 'הדגמה', 'לקוח'].map((name, i) => ({ id: `ps${i}`, name, sort: i, is_won: name === 'לקוח', suggested_step: name === 'הדגמה' ? 'לתאם הדגמה' : '', stuck_days: null })))
seed(['app-setting', 'pipeline.stuck_days'], '')
seed(['stage-history', 'd2'], [
  { id: 'sh1', doctor_id: 'd2', stage: 'פגישת היכרות', previous_stage: 'יצירת קשר', changed_at: ts(-100), by: { full_name: 'סוכן בדיקה' } },
  { id: 'sh2', doctor_id: 'd2', stage: 'יצירת קשר', previous_stage: '', changed_at: ts(-130), by: null },
])
seed(['stage-history', 'd6'], [])
seed(['stage-history', 'd5'], [])
addTo(['contacts'], [
  { id: 'ct1', name: 'רונית מזכירה', role: 'מזכירת רופא', phone: '052-1111111', office_phone: '', email: 'r@qa.test', notes: '', doctor_id: 'd1', hospital_id: null, created_at: ts(-9) },
])
