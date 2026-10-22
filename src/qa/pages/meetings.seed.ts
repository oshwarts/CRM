// Seed of the meetings list / meeting form: normal, boundary and awkward meetings (the base meetings m1-m3 are replaced).
import { d, mkMeeting, seed, ts } from '../seed'

const doc = (id: string, name: string, title = 'ד״ר') => ({ doctor: { id, name, title } })
const agent = (id: string, full_name: string) => ({ agent: { id, full_name, role: 'agent' } })
const task = (id: string, meeting_id: string, description: string, is_done = false, due_date: string | null = null) => ({
  id, meeting_id, description, is_done, due_date, done_at: is_done ? ts(-1) : null, created_at: ts(-4), updated_at: ts(-4), notes: '', priority: 'normal', recurrence: 'none',
  doctor_id: null, hospital_id: null, assignee_id: 'u-me', created_by: 'u-me',
})

const LONG = 'פגישה עם צוות ארוך מאוד של בית החולים לגבי הטמעת מערכת הרובוטיקה החדשה, כולל סקירת תהליכי עבודה, הכשרה, חוזים ואחזקה'

const MEETINGS = [
  // upcoming, a follow-up date in the past, with tasks (2 of 3 done)
  mkMeeting('m1', 'הדגמת רובוט', d(2), 'scheduled', {
    meeting_time: '09:30:00', location: 'חדר ישיבות 3', next_followup_date: d(-1), summary: 'סיכום קצר\nשורה שנייה', decisions: 'לשלוח הצעת מחיר',
    meeting_agents: [agent('u-agent', 'סוכן בדיקה')], extra_participants: 'ד״ר אורח',
    meeting_tasks: [task('mt1', 'm1', 'לשלוח הצעת מחיר', true, d(1)), task('mt2', 'm1', 'לתאם הדרכה', true), task('mt3', 'm1', 'משימה פתוחה +2.5', false, d(5))],
  }),
  // today
  mkMeeting('m2', 'פגישה היום', d(0), 'scheduled', { meeting_time: '14:00:00', meeting_doctors: [doc('d1', 'יוסי כהן'), doc('d2', 'דוד לוי', 'פרופ׳')], hospital_id: 'h2', hospital: { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' } }),
  // scheduled but the date has passed
  mkMeeting('m3', 'פגישה שעבר מועדה', d(-9), 'scheduled'),
  mkMeeting('m4', 'פגישת היכרות', d(-3), 'done', { summary: 'סיכום הפגישה', created_by: 'u-agent', meeting_tasks: [task('mt4', 'm4', 'שליחת חומרים', false, d(-2))] }),
  // needs follow-up with a future follow-up date
  mkMeeting('m5', 'בדיקת צורך בהמשך', d(-20), 'needs_followup', { next_followup_date: d(7), meeting_doctors: [], hospital_id: null, hospital: null, location: 'Zoom' }),
  // cancelled, in the future
  mkMeeting('m6', 'פגישה שבוטלה', d(10), 'cancelled'),
  // no date, no time, no doctor, no hospital
  mkMeeting('m7', '', null as never, 'scheduled', { meeting_time: null, meeting_doctors: [], hospital_id: null, hospital: null }),
  // awkward text: 120+ characters, mixed Hebrew / English, emoji, a very long unbroken word
  mkMeeting('m8', `${LONG} – MAKO Total Knee / THA 🚀`, d(1), 'scheduled', {
    location: 'Sheba Medical Center, Building 12, Floor 3, Room "Robotics" – חדר רובוטיקה',
    summary: `${'סיכום ארוך מאוד '.repeat(30)}\nhttps://example.com/${'a'.repeat(120)}`,
    decisions: `${'החלטה '.repeat(40)}`,
    meeting_doctors: [doc('d4', 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס'), doc('d3', 'משה שוחט')],
    meeting_agents: [agent('u-agent', 'סוכן בדיקה')], extra_participants: 'מישהו',
    created_by: 'u-agent',
  }),
  // another year (the date tile shows the year)
  mkMeeting('m9', 'פגישה משנה שעברה', d(-400), 'done', { hospital_id: 'h3', hospital: { id: 'h3', name: 'אסותא אשדוד' }, meeting_doctors: [doc('d4', 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס')] }),
  // the same day as m2 but earlier — checks the time order
  mkMeeting('m10', 'פגישת בוקר', d(0), 'scheduled', { meeting_time: '08:00:00' }),
]
seed(['meetings'], MEETINGS)
// the page of one meeting (deep link /meetings/m1) reads its own query
for (const m of MEETINGS) seed(['meeting', m.id], m, { keepWhenEmpty: true })

seed(['contacts'], [
  { id: 'c1', name: 'דנה רכש', role: 'מנהלת רכש', hospital_id: 'h1', phone: '', office_phone: '', email: '', notes: '' },
  { id: 'c2', name: 'אבי מכון דימות', role: '', hospital_id: 'h1', phone: '', office_phone: '', email: '', notes: '' },
  { id: 'c3', name: 'רותי מאיכילוב', role: 'מזכירה', hospital_id: 'h2', phone: '', office_phone: '', email: '', notes: '' },
])
