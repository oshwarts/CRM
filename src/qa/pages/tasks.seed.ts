// Seed of the tasks screen: day boundaries (yesterday / today / tomorrow / +7 / +8), urgent, done, recurring, sub-steps,
// coordinator, links, long and awkward text, another agent's tasks. `&many=1` adds 200 more (performance).
import { d, mkTask, seed, ts } from '../seed'

const me = { id: 'u-me', full_name: 'מנהל בדיקה' }
const other = { id: 'u-agent', full_name: 'סוכן בדיקה' }
const sub = (id: string, task_id: string, text: string, is_done = false, sort = 0) => ({ id, task_id, text, is_done, sort, created_at: ts(-3) })
const doc = { id: 'd1', name: 'יוסי כהן', title: 'ד״ר' }
const LONG = 'לתאם עם צוות בית החולים את כל פרטי ההטמעה של מערכת הרובוטיקה החדשה, כולל הדרכה, חוזים, אחזקה, מתכלים ותיאום מול הנהלת המחלקה '.repeat(3)

const tasks: ReturnType<typeof mkTask>[] = [
  mkTask('t1', 'להתקשר לד״ר כהן לגבי הצעת מחיר', d(-2), { priority: 'urgent', doctor_id: 'd1', doctor: doc }),
  mkTask('t2', 'לשלוח דוח מתכלים', d(0)),
  mkTask('t3', 'משימה חוזרת שבועית', d(3), { recurrence: 'weekly', hospital_id: 'h1', hospital: { id: 'h1', name: 'שיבא – תל השומר' } }),
  mkTask('t4', 'ללא תאריך', null),
  mkTask('t5', 'בוצעה אתמול', d(-1), { is_done: true, status: 'done', done_at: ts(-1) }),
  mkTask('t6', 'משימה של סוכן אחר', d(1), { assignee_id: 'u-agent', assignee: other }),
  mkTask('t7', 'אתמול בדיוק', d(-1)),
  mkTask('t8', 'מחר בדיוק', d(1), { priority: 'urgent' }),
  mkTask('t9', 'בעוד 7 ימים (סוף "השבוע הקרוב")', d(7)),
  mkTask('t10', 'בעוד 8 ימים (מאוחר יותר)', d(8)),
  mkTask('t11', 'דוח חודשי', d(20), { recurrence: 'monthly' }),
  mkTask('t12', 'משימה עם שלבים', d(2), {
    subtasks: [sub('s1', 't12', 'להכין מצגת', true, 0), sub('s2', 't12', 'לשלוח לאישור', false, 1), sub('s3', 't12', 'לקבוע פגישה', false, 2)],
    notes: 'הערה ארוכה\nשורה שנייה של ההערה',
  }),
  mkTask('t13', LONG, d(4), { notes: LONG, coordinator: { id: 'c1', name: 'דנה מלוגיסטיקה', role: 'מתאמת', phone: '', office_phone: '', email: '' }, coordinator_text: 'ואולי גם דני' }),
  mkTask('t14', 'Send MAKO quote to Dr. Cohen +2.5% 🚀 — דחוף', d(5), { doctor_id: 'd1', doctor: doc }),
  mkTask('t15', 'משימה מפגישה', d(2), { meeting_id: 'm1', meeting: { id: 'm1', subject: 'הדגמת רובוט' } }),
  mkTask('t16', 'משימת פרויקט תקועה', d(-5), { project_id: 'p1', project: { id: 'p1', name: 'פרויקט מקו' }, area: { id: 'a1', name: 'אזור צפון' }, status: 'blocked', waiting_for: 'אישור הנהלה' }),
  mkTask('t17', 'בוצעה לפני חודש', d(-30), { is_done: true, status: 'done', done_at: ts(-30), priority: 'urgent' }),
  mkTask('t18', 'משימה של סוכן אחר, באיחור', d(-4), { assignee_id: 'u-agent', assignee: other, priority: 'urgent' }),
  mkTask('t20', 'שם רופא ובית חולים ארוכים', d(9), {
    doctor_id: 'd4', doctor: { id: 'd4', name: 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס', title: 'פרופ׳' },
    hospital_id: 'h2', hospital: { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב ע״ש סוראסקי עם שם ארוך במיוחד לבדיקה' },
    assignee_id: 'u-agent', assignee: { id: 'u-agent', full_name: 'סוכן עם שם מלא ארוך מאוד לבדיקת גלישה של התווית' }, waiting_for: 'אישור מנהל הרכש של בית החולים ומשרד הבריאות',
  }),
  mkTask('t19', 'ברבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבורבור'.repeat(2), d(6)),
]

if (new URLSearchParams(window.location.search).has('many')) {
  for (let i = 0; i < 200; i++) {
    tasks.push(
      mkTask(`bulk${i}`, `משימה מספר ${i} — ${['להתקשר', 'לשלוח', 'לבדוק', 'לתאם'][i % 4]} בנושא ${i * 7}`, i % 9 === 0 ? null : d((i % 40) - 10), {
        priority: i % 11 === 0 ? 'urgent' : 'normal',
        assignee_id: i % 5 === 0 ? 'u-agent' : 'u-me',
        assignee: i % 5 === 0 ? other : me,
        is_done: i % 13 === 0,
        done_at: i % 13 === 0 ? ts(-(i % 20)) : null,
      }),
    )
  }
}

// after the other pages' seeds (some of them add / replace the shared task list in a timer), so that the screen shows exactly these rows
setTimeout(() => {
  seed(['tasks'], tasks)
  seed(['contacts'], [{ id: 'c1', name: 'דנה מלוגיסטיקה', role: 'מתאמת', hospital_id: null }, { id: 'c2', name: 'אבי', role: '', hospital_id: null }])
}, 400)
