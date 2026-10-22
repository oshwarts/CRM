// Seed of the meeting screen (/meetings/:id). The base meetings m1-m10 come from meetings.seed.ts (also under ['meeting', id]);
// here: awkward ones (m11-m15) and the history of the doctors (['doctor-meetings', doctorId]).
import { d, mkMeeting, seed, ts } from '../seed'

const doc = (id: string, name: string, title = 'ד״ר') => ({ doctor: { id, name, title } })
const task = (id: string, meeting_id: string, description: string, is_done = false, due_date: string | null = null) => ({
  id, meeting_id, description, is_done, due_date, done_at: is_done ? ts(-1) : null, created_at: ts(-4), updated_at: ts(-4), notes: '', priority: 'normal', recurrence: 'none',
  doctor_id: null, hospital_id: null, assignee_id: 'u-me', created_by: 'u-me',
})

const EXTRA = [
  // everything filled: contacts, a manager among the agents, competitor notes, the e-mail import marker, every task done, a late follow-up on a meeting that needs one
  mkMeeting('m11', 'סיכום רבעוני – MAKO / ROSA', d(-5), 'needs_followup', {
    summary: 'יובא ממייל: from=x@y.com\n\nנדון: מחירים\nשורה שנייה של הסיכום',
    decisions: 'לעדכן הצעה\nלהחזיר תשובה עד סוף החודש',
    competitor_notes: 'המתחרה הציע הנחה של 15% + הדרכה חינם. https://competitor.example.com/offer?utm=' + 'x'.repeat(80),
    next_followup_date: d(-2),
    meeting_doctors: [doc('d1', 'יוסי כהן'), doc('d3', 'משה שוחט')],
    meeting_contacts: [{ contact: { id: 'c1', name: 'דנה רכש', role: 'מנהלת רכש', hospital_id: 'h1' } }, { contact: { id: 'c2', name: 'אבי מכון דימות', role: '', hospital_id: 'h1' } }],
    meeting_agents: [{ agent: { id: 'u-me', full_name: 'מנהל בדיקה', role: 'admin' } }, { agent: { id: 'u-agent', full_name: 'סוכן בדיקה', role: 'agent' } }],
    meeting_tasks: [task('mt11a', 'm11', 'משימה ראשונה', true, d(-3)), task('mt11b', 'm11', 'משימה שנייה ' + 'ארוכה '.repeat(20), true), task('mt11c', 'm11', 'Send quote to בית החולים +2.5%', false, d(0))],
  }),
  // a very long summary: the mailto link and the Outlook link both overflow their limits
  mkMeeting('m12', 'סיכום ארוך מאוד', d(-1), 'done', {
    summary: Array.from({ length: 120 }, (_, i) => `נקודה ${i + 1}: דיון מפורט בנושא מספר ${i + 1} עם הצוות`).join('\n'),
    decisions: 'החלטה אחת',
  }),
  // only a contact, no doctor, no hospital, no responsible agent; a task with a past due date and a done one
  mkMeeting('m13', 'שיחה עם איש קשר', d(0), 'done', {
    meeting_time: null, hospital_id: null, hospital: null, meeting_doctors: [], responsible_agent_id: null, responsible_agent: null,
    meeting_contacts: [{ contact: { id: 'c3', name: 'רותי מאיכילוב', role: 'מזכירה', hospital_id: 'h2' } }],
    summary: 'https://example.com/' + 'a'.repeat(160), meeting_tasks: [task('mt13a', 'm13', 'משימה באיחור', false, d(-4))],
  }),
  // the date is in the past, never closed, a follow-up today, two doctors where one row is a broken join (doctor = null)
  mkMeeting('m14', 'פגישה שלא נסגרה', d(-30), 'scheduled', {
    next_followup_date: d(0), meeting_doctors: [doc('d2', 'דוד לוי', 'פרופ׳'), { doctor: null }, doc('d1', 'יוסי כהן')],
  }),
  // someone else's meeting (created by the other agent), a follow-up in the future, done
  mkMeeting('m15', 'פגישה של סוכן אחר', d(-7), 'done', { created_by: 'u-agent', next_followup_date: d(14), summary: 'סיכום', meeting_doctors: [doc('d2', 'דוד לוי', 'פרופ׳')] }),
]
for (const m of EXTRA) seed(['meeting', m.id], m, { keepWhenEmpty: true })

// the history of a doctor: every meeting he took part in (newest first), the open one included (the page filters it out)
seed(['doctor-meetings', 'd1'], [
  mkMeeting('m2', 'פגישה היום', d(0), 'scheduled'),
  mkMeeting('m4', 'פגישת היכרות', d(-3), 'done', { summary: 'סיכום הפגישה' }),
  mkMeeting('m1', 'הדגמת רובוט', d(2), 'scheduled'),
  mkMeeting('m9', 'פגישה ' + 'ארוכה מאוד '.repeat(12), d(-400), 'done', { summary: 'סיכום ארוך '.repeat(40) }),
  mkMeeting('m16', '', null as never, 'scheduled'),
])
seed(['doctor-meetings', 'd2'], [mkMeeting('m14', 'פגישה שלא נסגרה', d(-30), 'scheduled'), mkMeeting('m15', 'פגישה של סוכן אחר', d(-7), 'done')])
seed(['doctor-meetings', 'd3'], [mkMeeting('m11', 'סיכום רבעוני – MAKO / ROSA', d(-5), 'needs_followup')])
seed(['doctor-meetings', 'd4'], [mkMeeting('m8', 'פגישה ארוכה', d(1), 'scheduled')])
