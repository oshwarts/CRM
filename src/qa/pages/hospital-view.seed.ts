// QA data of the hospital page (/hospitals/:id): h1 rich (onboarding, MAKO, agents, contacts, volumes 2 years, tasks, surgeries, intel),
// h2 bare (no coordinates, robots, agents, doctors, contacts, volumes; status only suggested), h3 awkward text (long name, competitor robot, private).
// ?empty=1 keeps the three hospitals but empties every list on them.
import { d, mkHospital, mkMeeting, mkScan, mkTask, seed, ts, isEmptyMode } from '../seed'

if ((new URLSearchParams(window.location.search).get('path') ?? '').startsWith('/hospitals/')) {
  const empty = isEmptyMode()
  const year = new Date().getFullYear()
  const L = <T,>(rows: T[]): T[] => (empty ? [] : rows)

  const sys = { id: 's1', name: 'Mako', manufacturer: '' }
  const org = { id: 'o1', name: 'שירותי בריאות כללית' }
  const me = { id: 'u-me', full_name: 'מנהל בדיקה' }
  const ag = { id: 'u-agent', full_name: 'סוכן בדיקה' }
  const doc = (id: string, name: string, status: string, o: object = {}) => ({ id, name, title: 'ד״ר', position: 'מנהל יחידה', status, ...o })
  const link = (doctor: ReturnType<typeof doc>, o: object = {}) => ({ role_at_hospital: 'מנהל יחידה', sector: 'public', clinic_days: [], clinic_hours: '', clinic_note: '', doctor, ...o })

  const contact = (id: string, name: string, o: Record<string, unknown> = {}) => ({
    id, name, role: '', phone: '', office_phone: '', email: '', notes: '', hospital_id: 'h1', doctor_id: null, created_at: ts(-30), updated_at: ts(-30), ...o,
  })
  const contacts = [
    contact('c1', 'רחל מזכירה', { role: 'מזכירת רופא', phone: '050-1234567', office_phone: '03-5302222', email: 'rachel@shiba.test', notes: 'זמינה עד 15:00' }),
    contact('c2', 'אחות ראשית ארוכה מאוד בשם לבדיקת גלישה בכרטיס אחד Dr. Alexandria Montgomery-Featherstonehaugh', {
      role: 'אחות ראשית ואחראית על חדרי הניתוח ומחלקת עיקור ותפעול ' + 'מאוד '.repeat(8),
      phone: '+972-50-123-4567', email: 'very.long.email.address.for.overflow.test@subdomain.example-hospital.org.il', notes: 'הערה '.repeat(40) + ' +2.5 🙂',
    }),
    contact('c3', 'ללא טלפון', { role: 'רכש' }),
    contact('c4', 'רק אימייל', { email: 'only@mail.test' }),
    contact('c5', 'איש קשר של רופא', { hospital_id: null, doctor_id: 'd1', phone: '052-0000000' }),
    contact('c6', 'איש קשר בבית חולים אחר', { hospital_id: 'h-other', phone: '052-1111111' }),
  ]

  const dr1 = doc('d1', 'יוסי כהן', 'client')
  const dr2 = doc('d2', 'דוד לוי', 'potential', { title: 'פרופ׳', position: '' })
  const dr6 = doc('d6', 'רונית בר-לב המאוד ארוכה בשם ובתפקיד לבדיקת גלישה בכרטיס Dr. Alexandria Montgomery-Featherstonehaugh', 'client', { position: 'מנהלת המחלקה האורתופדית ויו״ר האגודה' })

  const vol = (id: string, doctor: ReturnType<typeof doc>, proc: { id: string; name: string }, y: number, count: number, company: { id: string; name: string } | null = null) => ({
    id, doctor_id: doctor.id, hospital_id: 'h1', procedure_id: proc.id, company_id: company?.id ?? null, year: y, count,
    doctor: { id: doctor.id, name: doctor.name, title: doctor.title }, hospital: { id: 'h1', name: 'שיבא – תל השומר', city: 'רמת גן' },
    procedure: { id: proc.id, name: proc.name, category: 'knee' }, company, updated_at: ts(-3),
  })
  const p1 = { id: 'p1', name: 'החלפת ברך' }
  const p2 = { id: 'p2', name: 'החלפת ירך' }
  const volumes = [
    vol('v1', dr1, p1, year, 40, { id: 'co1', name: 'Ami Technologies' }),
    vol('v2', dr1, p1, year, 12, { id: 'co2', name: 'J&J' }),
    vol('v3', dr1, p2, year, 7),
    vol('v4', dr6, p1, year, 3),
    vol('v5', dr1, p1, year - 1, 30),
    vol('v6', dr1, p2, year - 1, 20),
    vol('v7', dr6, p1, year - 3, 5),
  ]

  const h1 = mkHospital('h1', 'שיבא – תל השומר', {
    city: 'רמת גן', address: 'דרך שיבא 2', lat: 32.045, lng: 34.844, organization_id: 'o1', organization: org, commercial_status: 'onboarding',
    next_step: 'הצגה להנהלה', next_step_date: d(7),
    hospital_robotic_systems: [{ system_id: 's1', system: sys }],
    hospital_agents: [{ agent: me }, { agent: ag }],
    doctor_hospitals: L([
      link(dr1, { clinic_days: [0, 2, 4], clinic_hours: '08:00-14:00', clinic_note: 'קבלה בקומה 2' }),
      link(dr2, { role_at_hospital: '' }),
      link(dr6, { role_at_hospital: 'תפקיד ארוך מאוד '.repeat(5), clinic_days: [2], clinic_hours: '' }),
    ]),
    case_volumes: L(volumes.map((v) => ({ procedure_id: v.procedure_id, year: v.year, count: v.count, procedure: { name: v.procedure.name } }))),
    contacts: L(contacts.filter((c) => c.hospital_id === 'h1')),
  })
  const h2 = mkHospital('h2', 'איכילוב – מרכז רפואי תל אביב', {
    lat: null, lng: null, address: '', city: '', sector: '', commercial_status: '', hospital_robotic_systems: [], hospital_agents: [], doctor_hospitals: [], case_volumes: [], contacts: [],
  })
  const h3 = mkHospital('h3', 'בית חולים פרטי עם שם ארוך מאוד מאוד לבדיקת גלישה בכותרת הדף Dr. Montgomery Memorial Medical Center & Clinics', {
    city: 'אשדוד עם שם עיר ארוך', address: 'רחוב ארוך מאוד '.repeat(4), sector: 'private', commercial_status: 'competitor', organization: { id: 'o2', name: 'ארגון עם שם ארוך מאוד '.repeat(2) },
    next_step: 'צעד הבא ארוך מאוד '.repeat(10), next_step_date: d(-4),
    hospital_robotic_systems: [{ system: { id: 's2', name: 'VELYS' } }, { system: { id: 's3', name: 'ROSA' } }],
    hospital_agents: [], doctor_hospitals: [], case_volumes: [], contacts: [],
  })
  seed(['map-data'], [h1, h2, h3], { keepWhenEmpty: true })

  // this page's lists are its own (other pages' seeds put unrelated rows on the same hospital ids)
  const addTo = (key: unknown[], rows: { id: string }[]) => seed(key, rows)
  const apply = () => {
    seed(['contacts'], contacts)
    seed(['case-volumes', null, 'h1'], volumes)
    seed(['case-volumes', null, 'h2'], [])
    seed(['done-scan-counts'], [{ surgeon_id: 'd1', hospital_id: 'h1', procedure_name: 'החלפת ברך – MAKO', year, count: 4 }, { surgeon_id: 'd1', hospital_id: 'h1', procedure_name: 'החלפת ירך – MAKO', year: year - 1, count: 2 }])
    seed(['companies'], [{ id: 'co1', name: 'Ami Technologies' }, { id: 'co2', name: 'J&J' }])
    seed(['procedures'], [p1, p2, { id: 'p3', name: 'החלפת ברך – MAKO' }, { id: 'p4', name: 'החלפת ירך – MAKO' }].map((p) => ({ ...p, category: 'knee', parent_id: null, planning_template: 'generic' })))
    addTo(['meetings'], [
      mkMeeting('hm1', 'פגישת היכרות עם הנהלה', d(-3), 'done', { meeting_doctors: [{ doctor: dr1 }], meeting_contacts: [{ contact: { id: 'c1', name: 'רחל מזכירה' } }] }),
      mkMeeting('hm2', 'פגישה עתידית', d(4), 'scheduled'),
      mkMeeting('hm3', 'פגישה עתידית רחוקה', d(30), 'scheduled'),
      mkMeeting('hm4', 'פגישה שבוטלה', d(-1), 'cancelled'),
      mkMeeting('hm5', 'פגישה בבית חולים אחר', d(-2), 'done', { hospital_id: 'h2', hospital: { id: 'h2', name: 'איכילוב' }, meeting_doctors: [{ doctor: dr2 }] }),
      mkMeeting('hm6', 'נושא פגישה ארוך מאוד '.repeat(6), d(-40), 'done', { meeting_doctors: [{ doctor: dr6 }] }),
      mkMeeting('hm7', 'פגישה ישנה', d(-120), 'needs_followup'),
    ])
    const pl = (id: string, date: string, status: string, o: object = {}) => ({
      id, surgery_date: date, surgery_time: null, doctor_id: 'd1', hospital_id: 'h1', procedure: 'החלפת כתף', company: 'J&J', notes: 'הערה פרטית', cases: 1, agent_id: 'u-me', status,
      created_by: 'u-me', doctor: { id: 'd1', title: 'ד״ר', name: 'יוסי כהן' }, hospital: { id: 'h1', name: 'שיבא – תל השומר' }, agent: me, ...o,
    })
    seed(['planned-surgeries'], L([pl('ps1', d(3), 'planned', { cases: 3 }), pl('ps2', d(40), 'planned'), pl('ps3', d(-5), 'done'), pl('ps4', d(2), 'cancelled'), pl('ps5', d(-1), 'planned', { procedure: '', company: '', doctor: null, doctor_id: null }), pl('ps6', d(2), 'planned', { hospital_id: 'h2' })]))
    addTo(['tasks'], [
      mkTask('ht1', 'להכין מצגת להנהלת שיבא', d(-2), { hospital_id: 'h1', hospital: { id: 'h1', name: 'שיבא – תל השומר' }, priority: 'urgent' }),
      mkTask('ht2', 'לשלוח הצעת מחיר', d(0), { hospital_id: 'h1', hospital: { id: 'h1', name: 'שיבא – תל השומר' }, assignee_id: 'u-agent', assignee: ag }),
      mkTask('ht3', 'משימה שבוצעה', d(-1), { hospital_id: 'h1', is_done: true, status: 'done', done_at: ts(-1) }),
      mkTask('ht4', 'משימה של בית חולים אחר', d(1), { hospital_id: 'h2' }),
    ])
    seed(['competitor-intel'], L([{
      id: 'ci1', competitor: 'Stryker', competitor_id: null, product: 'Mako SmartRobotics', intel_date: d(-6), loyalty: 'loyal', offer: 'הנחה על חבילת מתכלים', notes: 'שמענו מהאחות הראשית',
      outcome: '', loss_reason: '', payment_terms: '', price_per_case: 3500, implant_price: null, tender_due: null, tender_name: '', contract_end: null, image_paths: [],
      doctor_id: null, hospital_id: 'h1', meeting_id: null, created_by: 'u-me', created_at: ts(-6), updated_at: ts(-6), doctor: null, hospital: { id: 'h1', name: 'שיבא – תל השומר' },
    }]))
    seed(['patient-scans'], L([mkScan('hs1', 'ישראל ישראלי', { surgery_date: d(5) }), mkScan('hs2', 'דינה כהן', { surgery_date: d(-9), status: 'done', procedure_type: 'hip' }), mkScan('hs3', 'בוטל', { surgery_date: d(1), status: 'cancelled' }), mkScan('hs4', 'ללא תאריך', { surgery_date: null, hospital_id: 'h1' }), mkScan('hs5', 'בית חולים אחר', { hospital_id: 'h2' })]))
    seed(['competitors'], [{ id: 'cp1', name: 'Stryker', products: 'Mako, Triathlon', reps: '', strengths: '', weaknesses: '', description: '', our_answer: '', learn_topic_id: null, sort: 0, active: true, created_at: ts(-100), updated_at: ts(-100) }])
  }
  queueMicrotask(apply)
  setTimeout(apply, 60)
  setTimeout(apply, 800)
}
