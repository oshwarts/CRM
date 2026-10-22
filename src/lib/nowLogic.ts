import type { CompetitorIntelRow, DoctorListItem, MeetingWithRelations, PatientScanRow, TaskRow } from './types'
import { SCAN_PROCEDURE_LABELS } from './types'
import { competitorAlerts, newActivity } from './competitors'
import { contactState } from './cadence'
import { inDaysLabel, isMyMeeting, lateByLabel } from './homeLogic'
import { localDay } from './localDay'
import { stageSinceMap, stuckPotentials, type HistoryRow, type StuckThresholds } from './pipelineStats'
import { rescanAlert, weekMissing } from './scanAlerts'
import { SUGGESTION_KIND_LABELS, SUGGESTION_STATUS_LABELS, type Suggestion } from './suggestions'
import type { UploadRequest } from './largeFiles'
import type { ProcedureRequest } from './procedures'
import { daysUntil, formatDate, plusDaysISO, todayISO } from './utils'

/* The pure logic of the "urgent now" page (Now.tsx): what needs me, in which group, in which order.
   Every date is a local yyyy-mm-dd; "today" is the clock of the device. */

export type NowIcon = 'task' | 'meeting' | 'scan' | 'doctor' | 'competitor' | 'target' | 'upload' | 'procedure' | 'suggestion' | 'backup'
export type NowGroupId = 'late' | 'today' | 'soon' | 'contact' | 'backup' | 'suggestions' | 'procedures' | 'uploads' | 'pipeline' | 'competitors'

export type NowItem = {
  key: string
  /** null = nothing to open (an answer the person only needs to read) */
  to: string | null
  icon: NowIcon
  title: string
  sub: string
  when: string
  /** the order inside the group (a plain string compare): the date, then the time */
  sort: string
}
export type NowGroupItems = { id: NowGroupId; items: NowItem[] }

export type NowInput = {
  userId: string | undefined
  isAdmin: boolean
  isDeveloper: boolean
  tasks: TaskRow[]
  meetings: MeetingWithRelations[]
  scans: PatientScanRow[]
  doctors: DoctorListItem[]
  favorites: string[]
  intel: CompetitorIntelRow[]
  /** the hospitals of the signed-in agent (null = not known yet) */
  myHospitals: string[] | null
  stageHistory: HistoryRow[]
  thresholds: StuckThresholds
  uploads: UploadRequest[]
  procRequests: ProcedureRequest[]
  suggestions: Suggestion[]
  /** the value of the "last backup" setting: '' = never, undefined = not known (not loaded / failed) */
  lastBackup: string | undefined
}

/** items of one kind are listed after the others of the same date and time */
const KIND_RANK = { meeting: '1', task: '2', scan: '3' } as const
const NO_TIME = '99:99'
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(0)}MB`
/** the days between a timestamp's local day and today (0 = today, negative = ago); a large negative number when unknown */
const daysSince = (iso: string | null) => daysUntil(localDay(iso)) ?? -99

type ScanReason = { rank: 0 | 1 | 2; text: string; when: string; date: string }

/** why a scan needs attention: late (0), today (1) or this week (2). A scan gets ONE row, in its most urgent group, listing all its reasons. */
function scanReasons(s: PatientScanRow, t: string, week: string): ScanReason[] {
  const out: ScanReason[] = []
  const ct = s.ct_date
  const sd = s.surgery_date
  // what is still missing before the surgery
  const gap = !ct ? 'אין תאריך CT' : !s.disk_collected ? 'הדיסק לא הועלה' : ''

  if (ct && ct < t && !s.scanned) out.push({ rank: 0, text: 'CT עבר ולא נסרק', when: `CT ${formatDate(ct)}`, date: ct })
  const rk = rescanAlert(s)
  if (rk === 'overdue') out.push({ rank: 0, text: 'סריקה חוזרת באיחור', when: `סריקה חוזרת ${formatDate(s.rescan_date)}`, date: s.rescan_date as string })
  if (rk === 'today') out.push({ rank: 1, text: 'סריקה חוזרת היום', when: 'סריקה חוזרת היום', date: t })
  if (rk === 'soon') out.push({ rank: 2, text: `סריקה חוזרת ${inDaysLabel(daysUntil(s.rescan_date) ?? 0)}`, when: `סריקה חוזרת ${formatDate(s.rescan_date)}`, date: s.rescan_date as string })

  if (ct === t && !s.scanned) out.push({ rank: 1, text: 'CT היום', when: 'CT היום', date: t })
  else if (ct && ct >= t) {
    // a CT in the coming week that still misses something (the day itself included, once it was done)
    const missing = weekMissing(s)
    if (missing.length > 0) out.push({ rank: ct === t ? 1 : 2, text: ct === t ? `CT היום — ${missing.join(', ')}` : `CT ${inDaysLabel(daysUntil(ct) ?? 0)} — ${missing.join(', ')}`, when: ct === t ? 'CT היום' : `CT ${formatDate(ct)}`, date: ct })
  }

  if (sd === t) out.push({ rank: 1, text: gap ? `ניתוח היום — ${gap}` : 'ניתוח היום', when: 'ניתוח היום', date: t })
  else if (sd && sd > t && sd <= week && gap) out.push({ rank: 2, text: `ניתוח ${inDaysLabel(daysUntil(sd) ?? 0)} — ${gap}`, when: `ניתוח ${formatDate(sd)}`, date: sd })
  return out
}

/** the groups of the page, in the order they are shown; a group with no items is left out */
export function buildNow(input: NowInput): NowGroupItems[] {
  const { userId, isAdmin, isDeveloper } = input
  const t = todayISO()
  const week = plusDaysISO(7)

  const myTasks = input.tasks.filter((x) => !x.is_done && x.status !== 'done' && x.assignee_id === userId)
  const openMeetings = input.meetings.filter((m) => m.meeting_date && m.status === 'scheduled' && isMyMeeting(m, userId))
  const activeScans = input.scans.filter((s) => s.status !== 'cancelled')

  const taskItem = (x: TaskRow): NowItem => ({
    key: `t${x.id}`,
    to: '/tasks',
    icon: 'task',
    title: x.description,
    sub: [x.doctor?.name, x.hospital?.name, x.priority === 'urgent' ? 'דחוף' : ''].filter(Boolean).join(' · '),
    when: x.due_date ? formatDate(x.due_date) : '',
    // on the same day an urgent task comes before the rest
    sort: `${x.due_date ?? ''} ${x.priority === 'urgent' ? '00:00' : NO_TIME}${KIND_RANK.task}`,
  })
  const meetingItem = (m: MeetingWithRelations): NowItem => ({
    key: `m${m.id}`,
    to: `/meetings/${m.id}`,
    icon: 'meeting',
    title: m.subject || 'פגישה',
    sub: [m.meeting_doctors.flatMap((d) => (d.doctor ? [d.doctor.name] : [])).join(', '), m.hospital?.name].filter(Boolean).join(' · '),
    when: `${formatDate(m.meeting_date)}${m.meeting_time ? ` ${m.meeting_time.slice(0, 5)}` : ''}`,
    sort: `${m.meeting_date} ${m.meeting_time ? m.meeting_time.slice(0, 5) : NO_TIME}${KIND_RANK.meeting}`,
  })

  // one row per scan, in its most urgent group
  const scanRows: { rank: number; item: NowItem }[] = []
  for (const s of activeScans) {
    const reasons = scanReasons(s, t, week)
    if (reasons.length === 0) continue
    const ordered = [...reasons].sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date))
    const first = ordered[0]
    scanRows.push({
      rank: first.rank,
      item: {
        key: `s${s.id}`,
        to: '/scans',
        icon: 'scan',
        title: `${s.patient_name || 'מטופל'} · ${SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type}`,
        sub: [ordered.map((r) => r.text).join(' · '), s.hospital?.name].filter(Boolean).join(' · '),
        when: first.when,
        sort: `${first.date} ${NO_TIME}${KIND_RANK.scan}`,
      },
    })
  }
  const scansOf = (rank: number) => scanRows.filter((r) => r.rank === rank).map((r) => r.item)
  // (a plain compare of the keys, not a locale one; the sort is stable, so equal keys keep their order)
  const bySort = (a: NowItem, b: NowItem) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)

  const late: NowItem[] = [
    ...myTasks.filter((x) => x.due_date && x.due_date < t).map(taskItem),
    ...openMeetings.filter((m) => m.meeting_date! < t).map((m) => {
      const it = meetingItem(m)
      return { ...it, sub: `עבר המועד — עדכן סיכום או קבע מחדש${it.sub ? ` · ${it.sub}` : ''}` }
    }),
    ...scansOf(0),
  ].sort(bySort)
  const today: NowItem[] = [
    ...myTasks.filter((x) => x.due_date === t).map(taskItem),
    ...openMeetings.filter((m) => m.meeting_date === t).map(meetingItem),
    ...scansOf(1),
  ].sort(bySort)
  const soon: NowItem[] = [
    ...scansOf(2),
    ...openMeetings.filter((m) => m.meeting_date! > t && m.meeting_date! <= week).map(meetingItem),
    ...myTasks.filter((x) => x.due_date && x.due_date > t && x.due_date <= week).map(taskItem),
  ].sort(bySort)

  // favourite doctors whose contact is due (the most overdue first); a doctor who was closed is not chased
  const fav = new Set(input.favorites)
  const toContact: NowItem[] = input.doctors
    .filter((d) => fav.has(d.id) && d.status !== 'lost' && d.contact_cadence_days)
    .map((d) => ({ d, st: contactState(d, input.meetings) }))
    .filter((x) => x.st.status === 'due' || x.st.status === 'soon')
    .sort((a, b) => (a.st.daysToDue ?? 0) - (b.st.daysToDue ?? 0))
    .map(({ d, st }) => ({
      key: `c${d.id}`,
      to: `/doctors/${d.id}`,
      icon: 'doctor' as const,
      title: `${d.title} ${d.name}`.trim(),
      sub: st.lastDate ? `קשר אחרון ${formatDate(st.lastDate)}` : 'אין פגישה מתועדת',
      when: st.status === 'due' ? lateByLabel(-(st.daysToDue ?? 0)) : inDaysLabel(st.daysToDue ?? 0),
      sort: st.dueDate ?? '',
    }))

  // opportunities against competitors: a contract or tender ending soon, and what was recorded this week at my hospitals.
  // A manager sees everything; an agent sees his hospitals (everything when he has none). Unknown hospitals yet (null): an agent sees none.
  const scope = isAdmin ? null : input.myHospitals
  const alerts = isAdmin || input.myHospitals !== null ? competitorAlerts(input.intel, scope, 60) : []
  const alertIds = new Set(alerts.map((a) => a.intel.id))
  const opportunities: NowItem[] = [
    ...alerts.map((a) => ({
      key: `k${a.key}`,
      to: '/competitors?tab=contracts',
      icon: 'competitor' as const,
      title: `${a.kind === 'contract' ? 'סיום חוזה' : `מכרז${a.intel.tender_name ? ` ${a.intel.tender_name}` : ''}`} · ${a.intel.competitor}`,
      sub: [a.intel.hospital?.name, a.intel.doctor?.name].filter(Boolean).join(' · '),
      when: a.days === 0 ? 'היום' : inDaysLabel(a.days),
      sort: a.date,
    })),
    // a record that is already shown above as an alert is not repeated
    ...(isAdmin || input.myHospitals !== null ? newActivity(input.intel, scope, userId) : [])
      .filter((i) => !alertIds.has(i.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((i) => ({
        key: `n${i.id}`,
        to: '/competitors',
        icon: 'competitor' as const,
        title: `פעילות חדשה של ${i.competitor}${i.product ? ` (${i.product})` : ''}`,
        sub: [i.hospital?.name, i.doctor?.name].filter(Boolean).join(' · '),
        when: formatDate(i.intel_date),
        sort: '',
      })),
  ]

  // potential doctors that need a push: no stage or next step, a late next step, too long in one stage
  const hospitals = input.myHospitals ?? []
  const myDoctors = input.doctors.filter((d) => isAdmin || d.created_by === userId || d.doctor_hospitals.some((h) => hospitals.includes(h.hospital_id)))
  const stuck: NowItem[] = stuckPotentials(myDoctors, stageSinceMap(input.stageHistory), input.thresholds).map(({ d, reasons }) => ({
    key: `p${d.id}`,
    to: `/doctors/${d.id}`,
    icon: 'target' as const,
    title: `${d.title} ${d.name}`.trim(),
    sub: [d.pipeline_stage || 'ללא שלב', ...reasons.map((r) => r.label)].join(' · '),
    when: d.next_step_date ? formatDate(d.next_step_date) : '',
    sort: '',
  }))

  // large files: the managers' requests to decide, and the answers to my own
  const uploadItems: NowItem[] = [
    ...(isAdmin ? input.uploads.filter((r) => r.status === 'pending').map((r) => ({ key: `u${r.id}`, to: '/settings?tab=uploads', icon: 'upload' as const, title: `בקשה להעלאת קובץ גדול: ${r.file_name}`, sub: [mb(r.file_size), r.purpose, r.requester?.full_name].filter(Boolean).join(' · '), when: formatDate(localDay(r.created_at)), sort: '' })) : []),
    ...input.uploads.filter((r) => r.requested_by === userId && r.status === 'approved').map((r) => ({ key: `ua${r.id}`, to: null, icon: 'upload' as const, title: `אושר — אפשר להעלות את ${r.file_name}`, sub: `${mb(r.file_size)} · בחר את הקובץ שוב באותו מקום והעלה`, when: '', sort: '' })),
    ...input.uploads.filter((r) => r.requested_by === userId && r.status === 'rejected' && daysSince(r.decided_at) >= -7).map((r) => ({ key: `ur${r.id}`, to: null, icon: 'upload' as const, title: `נדחתה ההעלאה של ${r.file_name}`, sub: r.decision_note || 'אפשר לפנות למנהל או להקטין את הקובץ', when: '', sort: '' })),
  ]

  // new procedures: the managers' requests to decide, and the answers to my own (for a week)
  const procItems: NowItem[] = [
    ...(isAdmin ? input.procRequests.filter((r) => r.status === 'pending').map((r) => ({ key: `pq${r.id}`, to: '/settings?tab=procedures', icon: 'procedure' as const, title: `בקשה להליך חדש: ${r.name}`, sub: [r.parent ? `תת-הליך של ${r.parent.name}` : '', r.requester?.full_name, r.note].filter(Boolean).join(' · '), when: formatDate(localDay(r.created_at)), sort: '' })) : []),
    ...input.procRequests.filter((r) => r.requested_by === userId && r.status !== 'pending' && daysSince(r.decided_at) >= -7).map((r) => ({ key: `pa${r.id}`, to: null, icon: 'procedure' as const, title: r.status === 'approved' ? `ההליך "${r.name}" אושר ונוסף לרשימה` : `הבקשה להליך "${r.name}" נדחתה`, sub: r.decision_note, when: '', sort: '' })),
  ]

  // suggestions for the system: the developer's new ones, and the answers to my own (for two weeks)
  const suggestionItems: NowItem[] = [
    ...(isDeveloper ? input.suggestions.filter((x) => x.status === 'new').map((x) => ({ key: `sg${x.id}`, to: '/users?tab=suggestions', icon: 'suggestion' as const, title: `${SUGGESTION_KIND_LABELS[x.kind]}: ${clip(x.body, 80)}`, sub: [x.author?.full_name, x.page].filter(Boolean).join(' · '), when: formatDate(localDay(x.created_at)), sort: '' })) : []),
    ...input.suggestions.filter((x) => x.created_by === userId && (x.status === 'done' || x.status === 'declined') && daysSince(x.handled_at) >= -14).map((x) => ({ key: `sa${x.id}`, to: null, icon: 'suggestion' as const, title: `ההצעה שלך ${SUGGESTION_STATUS_LABELS[x.status]}: ${clip(x.body, 60)}`, sub: x.dev_note, when: '', sort: '' })),
  ]

  // managers: a reminder when the manual backup is old (the free plan has no automatic one). Unknown (not loaded / failed) is no reminder.
  const lastBackup = input.lastBackup ? localDay(input.lastBackup) : null
  const backupDays = lastBackup ? -(daysUntil(lastBackup) ?? 0) : null
  const backupItems: NowItem[] = isAdmin && input.lastBackup !== undefined && (backupDays === null || backupDays > 7)
    ? [{ key: 'backup', to: '/users?tab=backup', icon: 'backup', title: backupDays === null ? 'עוד לא נעשה גיבוי של הנתונים' : `הגיבוי האחרון לפני ${backupDays} ימים`, sub: 'אין גיבוי אוטומטי בתוכנית החינמית — כדאי להוריד גיבוי אחת לשבוע', when: lastBackup ? formatDate(lastBackup) : '', sort: '' }]
    : []

  const all: NowGroupItems[] = [
    { id: 'late', items: late },
    { id: 'today', items: today },
    { id: 'soon', items: soon },
    { id: 'contact', items: toContact },
    { id: 'backup', items: backupItems },
    { id: 'suggestions', items: suggestionItems },
    { id: 'procedures', items: procItems },
    { id: 'uploads', items: uploadItems },
    { id: 'pipeline', items: stuck },
    { id: 'competitors', items: opportunities },
  ]
  return all.filter((g) => g.items.length > 0)
}
