// Base data of the QA harness (shared by every page). A page adds its own data in src/qa/pages/<page>.seed.ts.
// With ?empty=1 every seeded list is empty — the "new system, nothing yet" state.
import { queryClient } from '../lib/queryClient'

const empty = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('empty')

/** a date n days from today (yyyy-mm-dd, local) */
export function d(n: number): string {
  const x = new Date()
  x.setDate(x.getDate() + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
/** an ISO timestamp n days from now */
export const ts = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

/** put data into the query cache under a key (a list becomes [] in ?empty=1 mode; an object stays) */
export function seed(key: unknown[], value: unknown, opts: { keepWhenEmpty?: boolean } = {}) {
  queryClient.setQueryData(key, empty && !opts.keepWhenEmpty ? (Array.isArray(value) ? [] : value) : value)
}
export const isEmptyMode = () => empty

/** the signed-in profile of the harness (shaped like a row of profiles) */
export type QaProfile = { id: string; full_name: string; email: string; role: string; active: boolean; is_developer: boolean; is_test: boolean; is_content_editor: boolean; impersonating_id: null; status_changed_at: null; status_changed_by: null; created_at: string }

export function qaProfile(role: 'admin' | 'agent' | 'developer'): QaProfile {
  return {
    id: 'u-me',
    full_name: role === 'agent' ? 'סוכן בדיקה' : 'מנהל בדיקה',
    email: `${role}@qa.test`,
    role: role === 'agent' ? 'agent' : 'admin',
    active: true,
    is_developer: role === 'developer',
    is_test: false,
    is_content_editor: false,
    impersonating_id: null,
    status_changed_at: null,
    status_changed_by: null,
    created_at: '2026-01-01T00:00:00Z',
  } as unknown as QaProfile
}

/* ---------- factories (the shapes the app's queries return) ---------- */
export const mkHospital = (id: string, name: string, o: Record<string, unknown> = {}) => ({
  id, name, city: 'תל אביב', lat: 32.08, lng: 34.78, address: '', phone: '', sector: 'public', organization_id: null, status: 'client', commercial_status: 'client',
  next_step: '', next_step_date: null, notes: '', created_at: '2026-01-01T00:00:00Z', organization: null, hospital_robotic_systems: [], ...o,
})

export const mkDoctor = (id: string, name: string, status: 'client' | 'potential' | 'lost', o: Record<string, unknown> = {}) => ({
  id, name, title: 'ד״ר', position: 'מנהל יחידה', phone: '050-1234567', email: `${id}@qa.test`, notes: '', status, tracking_notes: '',
  pipeline_stage: status === 'potential' ? 'יצירת קשר' : '', next_step: '', next_step_date: null, contact_cadence_days: null,
  created_at: '2026-01-01T00:00:00Z', created_by: 'u-me', lost_reason: '', lost_at: null,
  doctor_companies: [], doctor_procedures: [], doctor_robotic_systems: [], doctor_hospitals: [], ...o,
})

export const mkTask = (id: string, description: string, due: string | null, o: Record<string, unknown> = {}) => ({
  id, description, notes: '', due_date: due, priority: 'normal', doctor_id: null, hospital_id: null, recurrence: 'none', assignee_id: 'u-me', created_by: 'u-me',
  is_done: false, done_at: null, status: 'open', subtasks: [], doctor: null, hospital: null, assignee: { id: 'u-me', full_name: 'מנהל בדיקה' }, project: null, area: null,
  contact: null, meeting: null, coordinator: null, coordinator_text: '', waiting_for: '', project_id: null, meeting_id: null, created_at: ts(-5), updated_at: ts(-5), ...o,
})

export const mkMeeting = (id: string, subject: string, date: string, status: 'scheduled' | 'done' | 'cancelled' | 'needs_followup', o: Record<string, unknown> = {}) => ({
  id, subject, meeting_date: date, meeting_time: '10:00:00', status, location: '', summary: '', decisions: '', next_followup_date: null, responsible_agent_id: 'u-me',
  responsible_agent: { id: 'u-me', full_name: 'מנהל בדיקה' }, hospital_id: 'h1', hospital: { id: 'h1', name: 'שיבא – תל השומר' },
  meeting_doctors: [{ doctor: { id: 'd1', name: 'יוסי כהן', title: 'ד״ר' } }], meeting_contacts: [], meeting_agents: [], meeting_tasks: [],
  extra_participants: '', competitor_notes: '', created_by: 'u-me', created_at: ts(-10), updated_at: ts(-10), ...o,
})

export const mkScan = (id: string, patient: string, o: Record<string, unknown> = {}) => ({
  id, hospital_id: 'h1', hospital: { id: 'h1', name: 'שיבא – תל השומר' }, surgeon_id: 'd1', surgeon: { id: 'd1', name: 'יוסי כהן', title: 'ד״ר' }, patient_name: patient,
  patient_phone: '', patient_id_number: '', patient_dob: null, health_fund: '', insurance: '', procedure_type: 'knee', side: 'ימין', surgery_date: d(5), ct_date: d(2), ct_time: '09:00:00',
  scanned: false, uploaded: false, disk_collected: false, plan_ready: false, rescan: false, rescan_date: null, rescan_reason: '', rescan_done: false, status: 'planned',
  implant_data: {}, notes: '', anaesthesia_note: '', created_by: 'u-me', created_at: ts(-3), updated_at: ts(-3), ...o,
})

/* ---------- the base data ---------- */
const h1 = mkHospital('h1', 'שיבא – תל השומר', { city: 'רמת גן', lat: 32.045, lng: 34.844, hospital_robotic_systems: [{ system_id: 's1' }] })
const h2 = mkHospital('h2', 'איכילוב – מרכז רפואי תל אביב', { hospital_robotic_systems: [{ system_id: 's2' }] })
const h3 = mkHospital('h3', 'אסותא אשדוד', { city: 'אשדוד', lat: 31.8, lng: 34.65, sector: 'private' })
const linkH = (h: { id: string; name: string }) => ({ hospital_id: h.id, hospital: h, role_at_hospital: '', sector: 'public' })

const d1 = mkDoctor('d1', 'יוסי כהן', 'client', { contact_cadence_days: 30, doctor_hospitals: [linkH(h1)] })
const d2 = mkDoctor('d2', 'דוד לוי', 'potential', { title: 'פרופ׳', next_step: 'לקבוע פגישת היכרות', next_step_date: d(-3), doctor_hospitals: [linkH(h2)] })
const d3 = mkDoctor('d3', 'משה שוחט', 'client', { phone: '', doctor_hospitals: [] })
const d4 = mkDoctor('d4', 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס', 'potential', { pipeline_stage: '', doctor_hospitals: [linkH(h3)] })

seed(['hospitals'], [h1, h2, h3])
seed(['doctors'], [d1, d2, d3, d4])
seed(['favorites'], ['d1', 'd2'])
seed(['agents'], [qaProfile('admin'), { ...(qaProfile('agent') as object), id: 'u-agent' }])
seed(['all-users'], [qaProfile('admin'), { ...(qaProfile('agent') as object), id: 'u-agent' }])
seed(['companies'], [{ id: 'co1', name: 'Ami Technologies' }, { id: 'co2', name: 'J&J' }])
seed(['robotic-systems'], [{ id: 's1', name: 'Mako' }, { id: 's2', name: 'VELYS' }])
seed(['procedures'], [{ id: 'p1', name: 'החלפת ברך', category: 'knee' }, { id: 'p2', name: 'החלפת ירך', category: 'hip' }])
seed(['tasks'], [
  mkTask('t1', 'להתקשר לד״ר כהן לגבי הצעת מחיר', d(-2), { priority: 'urgent', doctor_id: 'd1', doctor: { id: 'd1', name: 'יוסי כהן', title: 'ד״ר' } }),
  mkTask('t2', 'לשלוח דוח מתכלים', d(0)),
  mkTask('t3', 'משימה חוזרת שבועית', d(3), { recurrence: 'weekly' }),
  mkTask('t4', 'ללא תאריך', null),
  mkTask('t5', 'בוצעה', d(-1), { is_done: true, status: 'done', done_at: ts(-1) }),
  mkTask('t6', 'משימה של סוכן אחר', d(1), { assignee_id: 'u-agent', assignee: { id: 'u-agent', full_name: 'סוכן בדיקה' } }),
])
seed(['meetings'], [
  mkMeeting('m1', 'פגישת היכרות', d(-3), 'done', { summary: 'סיכום הפגישה' }),
  mkMeeting('m2', 'הדגמת רובוט', d(2), 'scheduled'),
  mkMeeting('m3', 'פגישה שעבר מועדה', d(-9), 'scheduled'),
])
seed(['patient-scans'], [mkScan('s1', 'ישראל ישראלי'), mkScan('s2', 'דינה כהן', { ct_date: d(-1), scanned: true, surgery_date: d(1), procedure_type: 'hip' })])
seed(['contacts'], [])
seed(['hospital-agents'], [{ hospital_id: 'h1', agent_id: 'u-me' }])
seed(['competitors'], [])
seed(['competitor-intel'], [])
seed(['case-volumes-all'], [])
