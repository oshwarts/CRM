// Seed of the calendar (/schedule): overlapping meetings, an all-day task, MAKO scans that add up to one line, surgeries entered by hand that add up
// (cases, earliest hour), no-hour lines, long and mixed Hebrew/English/emoji text, a cancelled and a done row, items in other weeks and months.
// `&many=1` adds 40 meetings in the current week. The seed is applied after every other page seed (they share the query keys) and only on /schedule.
import { d, mkMeeting, mkScan, mkTask, seed } from '../seed'

const params = new URLSearchParams(window.location.search)

/** n days from the Sunday that starts this week (the week the calendar opens on) */
const w = (n: number) => d(n - new Date().getDay())
const doc = (id: string, name: string, title = 'ד״ר') => ({ id, title, name })
const sheba = { id: 'h1', name: 'שיבא – תל השומר' }
const ichilov = { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' }
const LONG = 'סדנת הדרכה והטמעה למערכת הרובוטית החדשה כולל מתכלים, חוזים, אחזקה ותיאום מול הנהלת המחלקה'
const agent = { id: 'u-agent', full_name: 'סוכן בדיקה' }
const me = { id: 'u-me', full_name: 'מנהל בדיקה' }

const planned = (id: string, o: Record<string, unknown>) => ({
  id, surgery_date: w(1), surgery_time: null, doctor_id: 'd1', hospital_id: 'h1', procedure: 'החלפת ברך ידנית', company: '', notes: '', cases: 1, agent_id: 'u-agent',
  status: 'planned', created_by: 'u-me', doctor: doc('d1', 'יוסי כהן'), hospital: sheba, agent, ...o,
})

function apply() {
  const meetings = [
    mkMeeting('s1', 'הדגמת רובוט לצוות', d(0), 'scheduled', { meeting_time: '10:00:00', next_followup_date: w(5) }),
    mkMeeting('s2', 'פגישה חופפת – שיחה עם מנהל המחלקה', d(0), 'scheduled', { meeting_time: '10:30:00', hospital_id: 'h2', hospital: ichilov }),
    mkMeeting('s3', 'סיכום אחר הצהריים', d(0), 'scheduled', { meeting_time: '14:00:00' }),
    mkMeeting('s4', 'פגישה מחר', d(1), 'scheduled', { meeting_time: '08:30:00', responsible_agent_id: 'u-agent', responsible_agent: agent }),
    mkMeeting('s5', 'פגישה שבוצעה', d(-1), 'done', { meeting_time: '11:00:00' }),
    mkMeeting('s6', 'פגישה בחודש הבא', d(35), 'scheduled', { meeting_time: '09:00:00' }),
    mkMeeting('s7', 'פגישה בלי שעה', d(2), 'scheduled', { meeting_time: null }),
    mkMeeting('s8', 'פגישה שבוטלה', d(0), 'cancelled', { meeting_time: '12:00:00' }),
    mkMeeting('s9', `${LONG} 🤖 Mako +2.5 (v3.1)`, w(4), 'scheduled', { meeting_time: '23:30:00', meeting_doctors: [{ doctor: doc('d4', 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס', 'פרופ׳') }] }),
    mkMeeting('s10', 'Early sync 06:15', w(2), 'scheduled', { meeting_time: '06:15:00', meeting_doctors: [], hospital: null, hospital_id: null }),
    mkMeeting('s11', 'שבוע שעבר', w(-4), 'scheduled', { meeting_time: '13:00:00' }),
    mkMeeting('s12', 'שבוע הבא', w(9), 'scheduled', { meeting_time: '09:00:00' }),
  ]
  if (params.has('many'))
    for (let i = 0; i < 40; i++) meetings.push(mkMeeting(`many${i}`, `פגישה ${i + 1}`, w(i % 7), 'scheduled', { meeting_time: `${String(8 + (i % 9)).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00` }))
  seed(['meetings'], meetings)

  seed(['tasks'], [
    mkTask('t-s1', 'לשלוח הצעת מחיר לשוחט', d(0)),
    mkTask('t-s2', 'משימה לעוד יומיים', d(2), { assignee_id: 'u-agent', assignee: agent, doctor: doc('d3', 'משה שוחט'), hospital: sheba }),
    mkTask('t-s3', 'משימה שבוצעה', d(0), { is_done: true, status: 'done', done_at: new Date().toISOString() }),
    mkTask('t-s4', 'משימה בלי תאריך', null),
    mkTask('t-s5', LONG, w(3)),
  ])

  seed(['planned-surgeries'], [
    // three rows of the same surgeon / hospital / day / type: one line "6 × …", at the earliest hour
    planned('ps1', { cases: 2, surgery_time: '09:30:00', company: 'Zimmer', notes: 'חדר 3' }),
    planned('ps2', { cases: 3, surgery_time: '07:45:00', agent_id: 'u-me', agent: me }),
    planned('ps3', { cases: 1 }),
    planned('ps4', { doctor_id: 'd2', doctor: doc('d2', 'דוד לוי', 'פרופ׳'), hospital_id: 'h2', hospital: ichilov, procedure: 'Total knee – manual', company: 'Stryker', surgery_time: '08:00:00' }),
    planned('ps5', { surgery_date: w(1), doctor_id: null, doctor: null, hospital_id: null, hospital: null, procedure: '', agent_id: null, agent: null, created_by: 'u-agent' }),
    planned('ps6', { surgery_date: w(3), status: 'cancelled' }),
    planned('ps7', { surgery_date: w(-1), status: 'done', surgery_time: '10:00:00' }),
    planned('ps8', { surgery_date: w(2), procedure: LONG, notes: 'הערה ארוכה מאוד '.repeat(6), created_by: 'u-agent', surgery_time: '08:30:00' }),
  ])

  seed(['patient-scans'], [
    // two MAKO surgeries of the same surgeon / hospital / day / type: one line "2 × …"; a third of another type
    mkScan('sc1', 'ישראל ישראלי', { surgery_date: w(2), ct_date: w(0), ct_time: '08:15:00' }),
    mkScan('sc2', 'דינה כהן', { surgery_date: w(2), ct_date: w(1), ct_time: null }),
    mkScan('sc3', 'משה לוי', { surgery_date: w(2), procedure_type: 'hip', side: '' , ct_date: null }),
    mkScan('sc4', 'סריקה חוזרת לבדיקה', { surgery_date: null, ct_date: null, rescan: true, rescan_date: w(3), rescan_reason: 'איכות נמוכה' }),
    mkScan('sc5', 'ניתוח שבוטל', { surgery_date: w(2), status: 'cancelled' }),
    mkScan('sc6', 'ניתוח שבוצע', { surgery_date: w(-2), status: 'done', ct_date: null }),
  ])
  seed(['hospital-agents'], [{ hospital_id: 'h1', agent_id: 'u-me' }, { hospital_id: 'h1', agent_id: 'u-agent' }, { hospital_id: 'h2', agent_id: 'u-agent' }])
}

// after the other page seeds (the files are loaded in name order and several seed the same keys), before the first render
if (params.get('path')?.startsWith('/schedule')) {
  queueMicrotask(apply)
  setTimeout(apply, 60)
  setTimeout(apply, 800)
}
