// Seed of the calendar (day / week / month): overlapping meetings, an all-day task, a surgery with an hour, items in other weeks and months.
import { d, mkMeeting, mkTask, seed } from '../seed'

seed(['meetings'], [
  mkMeeting('s1', 'הדגמת רובוט לצוות', d(0), 'scheduled', { meeting_time: '10:00:00' }),
  mkMeeting('s2', 'פגישה חופפת – שיחה עם מנהל המחלקה', d(0), 'scheduled', { meeting_time: '10:30:00', hospital_id: 'h2', hospital: { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב' } }),
  mkMeeting('s3', 'סיכום אחר הצהריים', d(0), 'scheduled', { meeting_time: '14:00:00' }),
  mkMeeting('s4', 'פגישה מחר', d(1), 'scheduled', { meeting_time: '08:30:00' }),
  mkMeeting('s5', 'פגישה שבוצעה', d(-1), 'done', { meeting_time: '11:00:00' }),
  mkMeeting('s6', 'פגישה בחודש הבא', d(35), 'scheduled', { meeting_time: '09:00:00' }),
  mkMeeting('s7', 'פגישה בלי שעה', d(2), 'scheduled', { meeting_time: null }),
])
seed(['tasks'], [
  mkTask('t-s1', 'לשלוח הצעת מחיר לשוחט', d(0)),
  mkTask('t-s2', 'משימה לעוד יומיים', d(2)),
])
seed(['planned-surgeries'], [
  { id: 'ps1', surgery_date: d(1), surgery_time: '07:30:00', doctor_id: 'd1', hospital_id: 'h1', procedure: 'החלפת ברך ידנית', company: 'Zimmer', notes: '', cases: 2, agent_id: 'u-agent', status: 'planned', created_by: 'u-me', doctor: { id: 'd1', title: 'ד״ר', name: 'יוסי כהן' }, hospital: { id: 'h1', name: 'שיבא – תל השומר' }, agent: { id: 'u-agent', full_name: 'סוכן בדיקה' } },
])
