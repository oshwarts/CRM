import { useRef, useState } from 'react'
import { QuickDates } from './QuickDates'
import { Link } from 'react-router-dom'
import { Mail, Plus, Trash2, UserPlus } from 'lucide-react'
import {
  useAgents,
  useCompetitorIntel,
  useCompetitors,
  useContacts,
  useCreateMeeting,
  useDoctors,
  useHospitals,
  useUpdateMeeting,
  type MeetingFormData,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import {
  MEETING_STATUS_LABELS,
  type MeetingWithRelations,
} from '../lib/types'
import { plusDaysISO } from '../lib/utils'
import { toast } from '../lib/toast'
import { normalizeHe } from '../lib/contactMatch'
import type { MentionedDoctor } from '../lib/meetingDoctors'
import { NewDoctorFromMeeting, UnknownDoctorsHint } from './NewDoctorFromMeeting'
import {
  Field,
  Modal,
  MultiSelectChips,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from './ui'

type Props = {
  open: boolean
  onClose: () => void
  meeting?: MeetingWithRelations
  defaultDoctorId?: string
  defaultHospitalId?: string
  /** a new meeting that starts from a free hour of the calendar */
  defaultDate?: string
  defaultTime?: string
}

function initial(
  meeting: MeetingWithRelations | undefined,
  agentId: string | undefined,
  defaultDoctorId: string | undefined,
  defaultHospitalId?: string,
  defaultDate?: string,
  defaultTime?: string,
): MeetingFormData {
  return {
    subject: meeting?.subject ?? '',
    meeting_date: meeting?.meeting_date ?? defaultDate ?? null,
    meeting_time: meeting?.meeting_time?.slice(0, 5) ?? defaultTime ?? null,
    location: meeting?.location ?? '',
    responsible_agent_id: meeting?.responsible_agent_id ?? agentId ?? null,
    status: meeting?.status ?? 'scheduled',
    summary: meeting?.summary ?? '',
    decisions: meeting?.decisions ?? '',
    next_followup_date: meeting?.next_followup_date ?? null,
    doctorIds: meeting
      ? meeting.meeting_doctors.map((d) => d.doctor?.id).filter((x): x is string => !!x)
      : defaultDoctorId
        ? [defaultDoctorId]
        : [],
    hospitalId: meeting ? meeting.hospital_id : (defaultHospitalId ?? null),
    agentIds: meeting
      ? meeting.meeting_agents.map((a) => a.agent?.id).filter((x): x is string => !!x)
      : [],
    extraParticipants: meeting?.extra_participants ?? '',
    competitor_notes: meeting?.competitor_notes ?? '',
    competitorId: undefined, // not touched: the record of the meeting keeps its competitor
    contactIds: meeting
      ? meeting.meeting_contacts.map((c) => c.contact?.id).filter((x): x is string => !!x)
      : [],
    tasks: meeting
      ? meeting.meeting_tasks.map((t) => ({
          id: t.id,
          description: t.description,
          is_done: t.is_done,
          due_date: t.due_date,
        }))
      : [],
  }
}

const chipBtn =
  'rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 max-sm:!min-h-10'

/** pick doctors: the chosen ones stay on top, the rest are found by typing (a long list of chips is not scannable on a phone) */
function DoctorPicker({
  options,
  selected,
  onToggle,
}: {
  options: { id: string; label: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const words = normalizeHe(q).split(' ').filter(Boolean)
  const short = options.length <= 12
  const chosen = options.filter((o) => selected.includes(o.id))
  const rest = options.filter((o) => !selected.includes(o.id))
  const found = words.length ? rest.filter((o) => words.every((w) => normalizeHe(o.label).includes(w))) : short ? rest : []
  const shown = found.slice(0, 30)
  return (
    <div className="space-y-2">
      {!short && (
        <input
          type="search"
          className="input"
          placeholder="הקלד שם רופא כדי להוסיף"
          aria-label="חיפוש רופא להוספה"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <MultiSelectChips options={[...chosen, ...shown]} selected={selected} onToggle={onToggle} labelOf={(o) => o.label} />
      {found.length > shown.length && <p className="text-xs text-slate-600">יש עוד {found.length - shown.length} — המשך להקליד כדי לצמצם.</p>}
      {!short && !words.length && chosen.length === 0 && <p className="text-xs text-slate-600">לא נבחרו רופאים.</p>}
      {!short && words.length > 0 && found.length === 0 && <p className="text-xs text-slate-600">לא נמצא רופא בשם הזה.</p>}
    </div>
  )
}

export function MeetingFormModal({
  open,
  onClose,
  meeting,
  defaultDoctorId,
  defaultHospitalId,
  defaultDate,
  defaultTime,
}: Props) {
  const isEdit = !!meeting
  const { user } = useAuth()
  const agents = useAgents()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const contacts = useContacts()
  const competitors = useCompetitors()
  const intel = useCompetitorIntel()
  // the competitor the record of this meeting is tied to now (until the person picks another)
  const linkedCompetitor = (meeting ? (intel.data ?? []).find((i) => i.meeting_id === meeting.id)?.competitor_id : null) ?? ''
  const createMeeting = useCreateMeeting()
  const updateMeeting = useUpdateMeeting(meeting?.id ?? '', meeting)
  const saving = createMeeting.isPending || updateMeeting.isPending

  const [tab, setTab] = useState('general')
  const [data, setData] = useState<MeetingFormData>(() =>
    initial(meeting, user?.id, defaultDoctorId, defaultHospitalId, defaultDate, defaultTime),
  )
  const [error, setError] = useState<string | null>(null)
  const [focusTask, setFocusTask] = useState<number | null>(null)
  // a doctor named in the text who is not in the system: offered, created only when the person fills the small form and confirms
  const [newDoctor, setNewDoctor] = useState<{ title?: string; name: string } | null>(null)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const writtenText = [data.subject, data.summary, data.decisions, data.extraParticipants, data.competitor_notes].join('\n')
  const hint = (
    <UnknownDoctorsHint
      text={writtenText}
      dismissed={dismissed}
      onDismiss={(n) => setDismissed((s) => new Set(s).add(n))}
      onCreate={(m: MentionedDoctor) => setNewDoctor(m)}
    />
  )
  // what the form held when it opened - to know whether closing it loses something
  const opened = useRef(JSON.stringify(data))
  const submitting = useRef(false)
  const subjectRef = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(data) !== opened.current
  function close() {
    if (dirty && !window.confirm('לסגור בלי לשמור? מה שהזנת יאבד.')) return
    onClose()
  }

  function patch(p: Partial<MeetingFormData>) {
    setData((d) => ({ ...d, ...p }))
  }
  function patchTask(i: number, p: Partial<MeetingFormData['tasks'][number]>) {
    setData((d) => ({ ...d, tasks: d.tasks.map((t, x) => (x === i ? { ...t, ...p } : t)) }))
  }

  const [triedSave, setTriedSave] = useState(false)
  // a task row with a date, a tick or an existing task whose text was wiped would otherwise vanish silently
  const badTask = data.tasks.findIndex((t) => !t.description.trim() && (t.id || t.due_date || t.is_done))

  async function submit() {
    if (submitting.current) return
    setError(null)
    if (!data.subject.trim()) {
      setTab('general')
      setTriedSave(true)
      setTimeout(() => subjectRef.current?.focus(), 0)
      return
    }
    if (badTask >= 0) {
      setTab('content')
      setTriedSave(true)
      return
    }
    submitting.current = true
    try {
      const clean = { ...data, subject: data.subject.trim(), location: data.location.trim() }
      if (isEdit) await updateMeeting.mutateAsync(clean)
      else await createMeeting.mutateAsync(clean)
      toast(isEdit ? 'הפגישה עודכנה' : 'הפגישה נוספה')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : 'שמירה נכשלה')
    } finally {
      submitting.current = false
    }
  }

  const hospitalContacts = (contacts.data ?? []).filter((c) => c.hospital_id === data.hospitalId)

  return (
    <>
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? 'עריכת פגישה' : 'הוספת פגישה חדשה'}
      size="xl"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="general">פרטים כלליים</Tab>
          <Tab id="doctors">
            משתתפים
            {data.doctorIds.length + data.agentIds.length + data.contactIds.length > 0 &&
              ` (${data.doctorIds.length + data.agentIds.length + data.contactIds.length})`}
          </Tab>
          <Tab id="content">תוכן הפגישה</Tab>
        </TabList>

        <TabPanel id="general">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
            <Field
              label="נושא הפגישה"
              className="col-span-2"
              error={triedSave && !data.subject.trim() ? 'יש להזין נושא לפגישה' : undefined}
            >
              <input
                ref={subjectRef}
                className="input"
                value={data.subject}
                onChange={(e) => patch({ subject: e.target.value })}
                placeholder="הזן נושא הפגישה"
                enterKeyHint="done"
                autoComplete="off"
                required
                aria-invalid={triedSave && !data.subject.trim()}
              />
            </Field>
            <Field label="תאריך" className="col-span-2 min-w-0 sm:col-span-1">
              <input
                type="date"
                className="input"
                value={data.meeting_date ?? ''}
                onChange={(e) => patch({ meeting_date: e.target.value || null })}
              />
              <QuickDates value={data.meeting_date} onPick={(iso) => patch({ meeting_date: iso })} />
            </Field>
            <Field label="שעה" className="col-span-2 min-w-0 sm:col-span-1">
              <input
                type="time"
                className="input"
                value={data.meeting_time ?? ''}
                onChange={(e) => patch({ meeting_time: e.target.value || null })}
              />
            </Field>
            <Field label="בית חולים" className="col-span-2">
              <select
                className="input"
                value={data.hospitalId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null
                  // contacts belong to a hospital — drop the ones of the previous hospital
                  const keep = data.contactIds.filter(
                    (cid) => (contacts.data ?? []).find((c) => c.id === cid)?.hospital_id === id,
                  )
                  patch({ hospitalId: id, contactIds: keep })
                }}
              >
                <option value="">— ללא / מחוץ לבית חולים —</option>
                {(hospitals.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.city ? ` – ${h.city}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="סטטוס" className="col-span-2 sm:col-span-1">
              <select
                className="input"
                value={data.status}
                onChange={(e) => patch({ status: e.target.value })}
              >
                {Object.entries(MEETING_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="סוכן אחראי" className="col-span-2 sm:col-span-1">
              <select
                className="input"
                value={data.responsible_agent_id ?? ''}
                onChange={(e) =>
                  patch({ responsible_agent_id: e.target.value || null })
                }
              >
                <option value="">— ללא —</option>
                {(agents.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="מיקום (אופציונלי)" className="col-span-2">
              <input
                className="input"
                value={data.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="מיקום הפגישה"
                autoComplete="off"
              />
            </Field>

            <Field label="תאריך מעקב הבא (אופציונלי)" className="col-span-2">
              <input
                type="date"
                className="input sm:max-w-48"
                value={data.next_followup_date ?? ''}
                onChange={(e) =>
                  patch({ next_followup_date: e.target.value || null })
                }
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button type="button" className={chipBtn} onClick={() => patch({ next_followup_date: plusDaysISO(7) })}>
                  בעוד שבוע
                </button>
                <button type="button" className={chipBtn} onClick={() => patch({ next_followup_date: plusDaysISO(14) })}>
                  בעוד שבועיים
                </button>
                <button type="button" className={chipBtn} onClick={() => patch({ next_followup_date: plusDaysISO(30) })}>
                  בעוד חודש
                </button>
                {data.next_followup_date && (
                  <button
                    type="button"
                    className="rounded-full px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 max-sm:!min-h-10"
                    onClick={() => patch({ next_followup_date: null })}
                  >
                    נקה
                  </button>
                )}
              </div>
            </Field>
          </div>
        </TabPanel>

        <TabPanel id="doctors">
          <Field label="רופאים משתתפים">
            <DoctorPicker
              options={(doctors.data ?? []).map((d) => ({
                id: d.id,
                label: `${d.title} ${d.name}`,
              }))}
              selected={data.doctorIds}
              onToggle={(id) => {
                const adding = !data.doctorIds.includes(id)
                const next = adding ? [...data.doctorIds, id] : data.doctorIds.filter((x) => x !== id)
                // no hospital chosen yet: take the doctor's hospital when he has just one
                const links = (doctors.data ?? []).find((d) => d.id === id)?.doctor_hospitals ?? []
                const suggested = adding && !data.hospitalId && links.length === 1 ? links[0].hospital_id : null
                patch({ doctorIds: next, ...(suggested ? { hospitalId: suggested } : {}) })
              }}
            />
            <button type="button" className="btn-secondary mt-2" onClick={() => setNewDoctor({ name: '' })}>
              <UserPlus size={16} aria-hidden /> רופא חדש שלא ברשימה
            </button>
          </Field>
          {hint}
          <Field label="סוכנים ומנהלים משתתפים">
            <MultiSelectChips
              options={(agents.data ?? []).map((a) => ({
                id: a.id,
                label: `${a.full_name || a.email}${a.role === 'admin' ? ' (מנהל)' : ''}`,
              }))}
              selected={data.agentIds}
              onToggle={(id) =>
                patch({
                  agentIds: data.agentIds.includes(id)
                    ? data.agentIds.filter((x) => x !== id)
                    : [...data.agentIds, id],
                })
              }
              labelOf={(o) => o.label}
            />
          </Field>
          <Field label="אנשי קשר משתתפים (של בית החולים)">
            {data.hospitalId ? (
              hospitalContacts.length ? (
                <MultiSelectChips
                  options={hospitalContacts.map((c) => ({ id: c.id, label: c.role ? `${c.name} · ${c.role}` : c.name }))}
                  selected={data.contactIds}
                  onToggle={(id) =>
                    patch({
                      contactIds: data.contactIds.includes(id)
                        ? data.contactIds.filter((x) => x !== id)
                        : [...data.contactIds, id],
                    })
                  }
                  labelOf={(o) => o.label}
                />
              ) : (
                <p className="text-sm text-slate-600">
                  אין אנשי קשר לבית החולים הזה. אפשר להוסיף בהגדרות ← אנשי קשר (למשל רכש או מכון דימות).
                </p>
              )
            ) : (
              <p className="text-sm text-slate-600">
                בחר בית חולים ב
                <button type="button" className="font-medium text-brand-700 underline" onClick={() => setTab('general')}>
                  פרטים כלליים
                </button>{' '}
                כדי לבחור אנשי קשר.
              </p>
            )}
          </Field>
          <Field label="משתתפים נוספים (טקסט חופשי)">
            <textarea
              className="input min-h-16"
              dir="auto"
              placeholder="שמות של מי שאינו במערכת — למשל: ד״ר כהן (מנתח אורח), נציג חברה אחרת…"
              value={data.extraParticipants}
              onChange={(e) => patch({ extraParticipants: e.target.value })}
            />
          </Field>
        </TabPanel>

        <TabPanel id="content">
          <Field label="סיכום הפגישה">
            <textarea
              className="input min-h-28"
              dir="auto"
              value={data.summary}
              onChange={(e) => patch({ summary: e.target.value })}
            />
          </Field>
          {hint}
          <Field label="החלטות">
            <textarea
              className="input min-h-20"
              dir="auto"
              value={data.decisions}
              onChange={(e) => patch({ decisions: e.target.value })}
            />
          </Field>
          <Field label="פעילות מתחרים (אם עלתה בפגישה)">
            <select
              className="input mb-2"
              aria-label="איזה מתחרה"
              value={data.competitorId === undefined ? linkedCompetitor : (data.competitorId ?? '')}
              onChange={(e) => patch({ competitorId: e.target.value || null })}
            >
              <option value="">איזה מתחרה? (לא חובה)</option>
              {(competitors.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea
              className="input min-h-16"
              dir="auto"
              placeholder="מי מתחרה, מה הוא מציע, באיזה תנאים…"
              value={data.competitor_notes}
              onChange={(e) => patch({ competitor_notes: e.target.value })}
            />
          </Field>
          <Field label="משימות להמשך">
            <div className="space-y-2">
              {data.tasks.map((t, i) => (
                <div key={t.id ?? `new-${i}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-7 w-7 shrink-0"
                      aria-label={`משימה ${i + 1} בוצעה`}
                      checked={t.is_done}
                      onChange={(e) => patchTask(i, { is_done: e.target.checked })}
                    />
                    <input
                      className="input min-w-0 flex-1"
                      dir="auto"
                      placeholder="תיאור המשימה"
                      aria-label={`תיאור משימה ${i + 1}`}
                      aria-invalid={triedSave && i === badTask}
                      autoFocus={focusTask === i}
                      enterKeyHint="next"
                      onKeyDown={(e) => {
                        // Enter in a task adds the next one instead of saving the whole meeting
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          if (!t.description.trim()) return
                          setFocusTask(data.tasks.length)
                          patch({ tasks: [...data.tasks, { description: '', is_done: false, due_date: null }] })
                        }
                      }}
                      value={t.description}
                      onChange={(e) => patchTask(i, { description: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-ghost !min-h-10 !px-2 text-red-600"
                      aria-label={`הסרת משימה ${i + 1}`}
                      title="הסרת משימה"
                      onClick={() => patch({ tasks: data.tasks.filter((_, x) => x !== i) })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {triedSave && i === badTask && (
                    <p role="alert" className="mt-1 ps-9 text-xs font-medium text-red-600">
                      יש להזין תיאור למשימה או להסיר אותה
                    </p>
                  )}
                  <label className="mt-1.5 flex items-center gap-2 ps-9 text-xs text-slate-600">
                    <span className="shrink-0">תאריך יעד</span>
                    <input
                      type="date"
                      className="input min-w-0 flex-1 sm:max-w-44"
                      value={t.due_date ?? ''}
                      onChange={(e) => patchTask(i, { due_date: e.target.value || null })}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFocusTask(data.tasks.length)
                  patch({
                    tasks: [...data.tasks, { description: '', is_done: false, due_date: null }],
                  })
                }}
              >
                <Plus size={16} />
                הוסף משימה
              </button>
            </div>
          </Field>
        </TabPanel>
      </Tabs>

      {isEdit && meeting && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
          <Link to={`/meetings/${meeting.id}?mail=1`} className="inline-flex min-h-10 items-center gap-1 font-medium text-brand-700 hover:underline">
            <Mail size={14} />
            שלח סיכום במייל
          </Link>
          (שמור קודם את השינויים)
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="btn-secondary max-sm:flex-1" onClick={close}>
          ביטול
        </button>
        <button type="submit" className="btn-primary max-sm:flex-[2]" disabled={saving}>
          {saving ? 'שומר…' : 'שמירה'}
        </button>
      </div>
      </form>
    </Modal>
    {newDoctor && (
      <NewDoctorFromMeeting
        initial={newDoctor}
        hospitalId={data.hospitalId}
        onClose={() => setNewDoctor(null)}
        onCreated={(id) => {
          setData((d) => ({ ...d, doctorIds: d.doctorIds.includes(id) ? d.doctorIds : [...d.doctorIds, id] }))
          setNewDoctor(null)
        }}
      />
    )}
    </>
  )
}
