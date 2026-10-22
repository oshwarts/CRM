// Seed of the hospitals screen (/map): 10 hospitals with every status / warning / boundary (60 vs 61 days, 30 vs 31 days), a long name,
// a hospital without coordinates, one without anything. ?many=1 makes it 100 hospitals for the performance check.
// Today in the comments = the day the page is opened.
import { d, mkHospital, mkMeeting, mkScan, seed } from '../seed'

const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const many = q.has('many')
// the seeds of all pages share one query cache: apply this one only on this screen, and again after the other seeds' timers
const active = ['/map', '/hospitals'].includes((q.get('path') ?? '').split('?')[0])
const queue: (() => void)[] = []
const put = (key: unknown[], value: unknown) => queue.push(() => seed(key, value))

const robot = (id: string, name: string) => ({ system: { id, name } })
const agent = (id: string, full_name: string) => ({ agent: { id, full_name } })
const contact = (id: string, hospital_id: string, name: string, phone = '') => ({ id, name, role: 'רכש', hospital_id, phone, office_phone: '', email: '', notes: '' })
const dh = (id: string, name: string, status = 'client') => ({ role_at_hospital: '', sector: 'public', clinic_days: [], clinic_hours: '', clinic_note: '', doctor: { id, name, title: 'ד״ר', position: 'מנהל יחידה', status } })

const LONG = 'המרכז הרפואי האוניברסיטאי על שם פרופסור מאוד ארוך – Medical Center of Excellence 🏥 +2.5'

const base = (id: string, name: string, o: Record<string, unknown> = {}) => ({
  ...mkHospital(id, name, { commercial_status: '', ...o }),
  hospital_agents: [], hospital_robotic_systems: [], case_volumes: [], contacts: [], doctor_hospitals: [], ...o,
})

const HOSPITALS = [
  // client, Mako, my hospital, a phone, 2 MAKO surgeries in the last 30 days, last meeting 5 days ago
  base('h1', 'שיבא – תל השומר', {
    city: 'רמת גן', lat: 32.045, lng: 34.844, commercial_status: 'client', organization: { id: 'o1', name: 'שירותי בריאות כללית' }, next_step: 'להציג הצעת מחיר', next_step_date: d(4),
    hospital_agents: [agent('u-me', 'מנהל בדיקה')], hospital_robotic_systems: [robot('s1', 'Mako')], contacts: [contact('c1', 'h1', 'דנה רכש', '050-1112222')],
    doctor_hospitals: [dh('d1', 'יוסי כהן'), dh('d3', 'משה שוחט')],
    case_volumes: [{ procedure_id: 'p1', year: 2026, count: 40, procedure: { name: 'החלפת ברך' } }, { procedure_id: 'p2', year: 2026, count: 15, procedure: { name: 'החלפת ירך' } }],
  }),
  // no status stored: Velys -> suggested "competitor"; no agent, no contact, no meeting at all
  base('h2', 'איכילוב – מרכז רפואי תל אביב', { hospital_robotic_systems: [robot('s2', 'VELYS')], doctor_hospitals: [dh('d2', 'דוד לוי', 'potential')], organization: { id: 'o2', name: 'מכבי' } }),
  // no coordinates (listed, not pinned), private, potential, agent u-agent
  base('h3', 'אסותא אשדוד', { city: 'אשדוד', lat: null, lng: null, sector: 'private', commercial_status: 'potential', hospital_agents: [agent('u-agent', 'סוכן בדיקה')], contacts: [contact('c2', 'h3', 'רותי מזכירה', '')] }),
  // a very long awkward name, in the middle of onboarding
  base('h4', LONG, { city: 'ירושלים', lat: 31.77, lng: 35.2, commercial_status: 'onboarding', hospital_agents: [agent('u-me', 'מנהל בדיקה'), agent('u-agent', 'סוכן בדיקה')], hospital_robotic_systems: [robot('s1', 'Mako'), robot('s2', 'VELYS')], contacts: [contact('c3', 'h4', 'איש קשר', '03-5555555')] }),
  // irrelevant: never warns
  base('h5', 'מרפאה לא רלוונטית', { city: 'אילת', lat: 29.55, lng: 34.95, commercial_status: 'irrelevant' }),
  // client, last meeting 61 days ago (warns), no surgeries (quiet client)
  base('h6', 'הדסה עין-כרם', { city: 'ירושלים', lat: 31.76, lng: 35.15, commercial_status: 'client', hospital_agents: [agent('u-agent', 'סוכן בדיקה')], hospital_robotic_systems: [robot('s1', 'Mako')], contacts: [contact('c4', 'h6', 'מנהל', '052-0000000')] }),
  // potential, last meeting exactly 60 days ago (no visit warning), a surgery exactly 30 days ago counts, 31 days ago does not
  base('h7', 'רמב״ם חיפה', { city: 'חיפה', lat: 32.83, lng: 34.99, commercial_status: 'potential', hospital_agents: [agent('u-me', 'מנהל בדיקה')], contacts: [contact('c5', 'h7', 'דני', '054-1')] }),
  // met today, a planned surgery in 30 days (counts) and in 31 days (does not)
  base('h8', 'סורוקה באר שבע', { city: 'באר שבע', lat: 31.26, lng: 34.8, commercial_status: 'potential', hospital_agents: [agent('u-agent', 'סוכן בדיקה')], contacts: [contact('c6', 'h8', 'רונית', '')] }),
  // only a future meeting and a cancelled one, so "never met"
  base('h9', 'בית חולים ללא ביקורים', { city: 'נתניה', lat: 32.33, lng: 34.86, commercial_status: 'potential', hospital_agents: [agent('u-agent', 'סוכן בדיקה')], contacts: [contact('c7', 'h9', 'מישהו', '03')] }),
  // nothing at all: an empty city, no organization
  base('h10', 'x', { city: '', lat: 32.0, lng: 34.7, commercial_status: 'competitor' }),
]

const all = many
  ? [
      ...HOSPITALS,
      ...Array.from({ length: 90 }, (_, i) =>
        base(`hx${i}`, `בית חולים לבדיקה ${i + 1}`, {
          city: ['חיפה', 'תל אביב', 'באר שבע', 'ירושלים'][i % 4], lat: 29.6 + (i % 30) * 0.12, lng: 34.3 + (i % 20) * 0.08, commercial_status: ['client', 'potential', 'onboarding', '', 'competitor'][i % 5],
          hospital_agents: i % 3 ? [agent('u-agent', 'סוכן בדיקה')] : [], hospital_robotic_systems: i % 2 ? [robot('s1', 'Mako')] : [], contacts: i % 4 ? [contact(`cx${i}`, `hx${i}`, 'איש קשר', '050')] : [],
        }),
      ),
    ]
  : HOSPITALS

const done = (id: string, hospital_id: string, ago: number, status: 'done' | 'needs_followup' | 'scheduled' | 'cancelled' = 'done') =>
  mkMeeting(id, `פגישה ${id}`, d(-ago), status, { hospital_id, hospital: { id: hospital_id, name: 'x' } })

put(['map-data'], all)
put(['hospitals'], all)
put(['meetings'], [
  done('m1', 'h1', 5), done('m1b', 'h1', 20), done('m6', 'h6', 61), done('m7', 'h7', 60, 'needs_followup'), done('m8', 'h8', 0),
  done('m9a', 'h9', -7, 'scheduled'), done('m9b', 'h9', 3, 'cancelled'), done('m4', 'h4', 100), done('m3', 'h3', 2, 'scheduled'),
])
put(['patient-scans'], [
  mkScan('s1', 'ישראל ישראלי', { hospital_id: 'h1', surgery_date: d(-3), status: 'done' }),
  mkScan('s2', 'דינה כהן', { hospital_id: 'h1', surgery_date: d(2) }),
  mkScan('s3', 'מבוטל', { hospital_id: 'h1', surgery_date: d(-1), status: 'cancelled' }),
  mkScan('s4', 'בדיוק 30', { hospital_id: 'h7', surgery_date: d(-30), status: 'done' }),
  mkScan('s5', 'בדיוק 31', { hospital_id: 'h7', surgery_date: d(-31), status: 'done' }),
  mkScan('s6', 'בלי תאריך', { hospital_id: 'h7', surgery_date: null }),
])
put(['planned-surgeries'], [
  { id: 'ps1', surgery_date: d(30), surgery_time: null, doctor_id: null, hospital_id: 'h8', procedure: 'ברך', company: '', notes: '', cases: 2, agent_id: 'u-me', status: 'planned', created_by: 'u-me', doctor: null, hospital: { id: 'h8', name: 'x' }, agent: null },
  { id: 'ps2', surgery_date: d(31), surgery_time: null, doctor_id: null, hospital_id: 'h8', procedure: 'ירך', company: '', notes: '', cases: 5, agent_id: 'u-me', status: 'planned', created_by: 'u-me', doctor: null, hospital: { id: 'h8', name: 'x' }, agent: null },
  { id: 'ps3', surgery_date: d(-10), surgery_time: null, doctor_id: null, hospital_id: 'h6', procedure: 'ברך', company: '', notes: '', cases: 3, agent_id: 'u-me', status: 'cancelled', created_by: 'u-me', doctor: null, hospital: { id: 'h6', name: 'x' }, agent: null },
  { id: 'ps4', surgery_date: d(-10), surgery_time: null, doctor_id: null, hospital_id: 'h4', procedure: 'ברך', company: '', notes: '', cases: 3, agent_id: 'u-me', status: 'done', created_by: 'u-me', doctor: null, hospital: { id: 'h4', name: 'x' }, agent: null },
  { id: 'ps5', surgery_date: d(-10), surgery_time: null, doctor_id: null, hospital_id: 'h2', procedure: 'ברך', company: '', notes: '', cases: 0, agent_id: 'u-me', status: 'done', created_by: 'u-me', doctor: null, hospital: { id: 'h2', name: 'x' }, agent: null },
])

if (active) {
  const apply = () => queue.forEach((f) => f())
  queueMicrotask(apply)
  setTimeout(apply, 60)
  setTimeout(apply, 800)
}
