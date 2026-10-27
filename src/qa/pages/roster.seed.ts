// Seed of the roster (/roster): three agents (one overloaded), reported availability across the week (full day, one shift only,
// unavailable with a reason, and a day nobody reported yet), assignments linked to a task and a meeting, an upcoming CT that should
// show up as a suggestion, and a few roster notifications in "u-me"'s own inbox. ?empty=1 empties the lists; a closed week is set up
// from the console with __qa (the close date is "now", so it is not reproducible from a static seed).
import { d, mkHospital, seed } from '../seed'

const params = new URLSearchParams(window.location.search)
if ((params.get('path') ?? '') === '/roster') {
  const empty = params.has('empty')
  const L = <T,>(rows: T[]): T[] => (empty ? [] : rows)

  /** n days from the Sunday that starts this week (the week the page opens on) */
  const w = (n: number) => d(n - new Date().getDay())

  const h1 = mkHospital('h1', 'שיבא – תל השומר')
  const h2 = mkHospital('h2', 'איכילוב – מרכז רפואי תל אביב')
  const agents = [
    { id: 'u-me', full_name: 'מנהל בדיקה', role: 'admin', active: true },
    { id: 'u-agent', full_name: 'סוכן בדיקה', role: 'agent', active: true },
    { id: 'u-agent2', full_name: 'דנה כהן-שם ארוך לבדיקת גלישה בכרטיס', role: 'agent', active: true },
  ]

  const apply = () => {
    seed(['agents'], agents)
    seed(['hospitals'], [h1, h2])
    seed(['hospital-agents'], L([
      { hospital_id: 'h1', agent_id: 'u-agent' },
      { hospital_id: 'h2', agent_id: 'u-agent2' },
      { hospital_id: 'h1', agent_id: 'u-agent2' },
    ]))
    seed(
      ['tasks'],
      L([
        {
          id: 'rt1', description: 'מעקב אחרי ד"ר כהן לקראת ניתוח', notes: '', due_date: w(2), priority: 'urgent', doctor_id: null, hospital_id: 'h1',
          recurrence: 'none', assignee_id: 'u-agent', created_by: 'u-me', is_done: false, done_at: null, status: 'open', subtasks: [],
          doctor: null, hospital: { id: 'h1', name: h1.name }, assignee: { id: 'u-agent', full_name: 'סוכן בדיקה' }, project: null, area: null,
          contact: null, meeting: null, coordinator: null, coordinator_text: '', external_owner: '', waiting_for: '', project_id: null, meeting_id: null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        },
      ]),
    )
    seed(
      ['meetings'],
      L([
        {
          id: 'rm1', subject: 'סיור היכרות עם מנהל חדר ניתוח', meeting_date: w(2), meeting_time: '10:00:00', status: 'scheduled',
          hospital_id: 'h2', hospital: { id: 'h2', name: h2.name }, responsible_agent_id: 'u-agent2', location: '', decisions: '', summary: '',
          extra_participants: '', competitor_notes: '', next_followup_date: null, created_by: 'u-me', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          meeting_doctors: [], meeting_contacts: [], meeting_agents: [], meeting_tasks: [],
        },
      ]),
    )
    seed(
      ['patient-scans'],
      L([
        { id: 'rs1', hospital_id: 'h1', hospital: { id: 'h1', name: h1.name }, surgeon_id: null, surgeon: null, patient_name: 'מטופל', ct_date: w(3), ct_time: '09:00:00', surgery_date: null, status: 'planned', procedure_type: 'knee', side: '', scanned: false, uploaded: false, disk_collected: false, rescan: false, rescan_date: null, rescan_done: false, rescan_reason: '' },
      ]),
    )

    const avail = (agent_id: string, date: string, shift: 'morning' | 'evening', status: 'available' | 'unavailable', reason = '') => ({
      agent_id, date, shift, status, reason, note: '',
    })
    seed(
      ['roster-availability', w(0), w(6)],
      L([
        avail('u-agent', w(0), 'morning', 'available'),
        avail('u-agent', w(0), 'evening', 'available'),
        avail('u-agent', w(1), 'morning', 'unavailable', 'תור רופא'),
        avail('u-agent', w(1), 'evening', 'available'),
        avail('u-agent', w(2), 'morning', 'available'),
        avail('u-agent', w(2), 'evening', 'available'),
        avail('u-agent2', w(0), 'morning', 'unavailable', 'מילואים'),
        avail('u-agent2', w(0), 'evening', 'unavailable', 'מילואים'),
        avail('u-agent2', w(2), 'morning', 'available'),
      ]),
      { keepWhenEmpty: true },
    )
    seed(
      ['roster-assignments', w(0), w(6)],
      L([
        { id: 'ra1', agent_id: 'u-agent', date: w(0), shift: 'morning', hospital_id: 'h1', area: '', work_type: 'field', task_id: null, meeting_id: null, note: '', updated_by: 'u-me', updated_at: new Date().toISOString() },
        { id: 'ra2', agent_id: 'u-agent2', date: w(2), shift: 'morning', hospital_id: 'h2', area: '', work_type: 'field', task_id: null, meeting_id: 'rm1', note: '', updated_by: 'u-me', updated_at: new Date().toISOString() },
      ]),
      { keepWhenEmpty: true },
    )
    seed(['roster-week', w(0)], null)
    seed(
      ['roster-notifications', 'u-me'],
      L([
        { id: 'rn1', agent_id: 'u-me', week_start: w(0), kind: 'week_closed', message: `הלוז שלך לשבוע ${w(0)}–${w(6)} פורסם`, date: null, shift: null, created_by: 'u-me', created_at: new Date(Date.now() - 86_400_000).toISOString(), read_at: null },
        { id: 'rn2', agent_id: 'u-me', week_start: w(0), kind: 'assignment_changed', message: 'השיבוץ שלך למשמרת בוקר ' + w(1) + ' עודכן: איכילוב', date: w(1), shift: 'morning', created_by: 'u-me', created_at: new Date(Date.now() - 3_600_000).toISOString(), read_at: new Date().toISOString() },
      ]),
    )
  }

  // after the other page seeds (shared query keys), before the first render
  queueMicrotask(apply)
  setTimeout(apply, 60)
  setTimeout(apply, 800)
}
