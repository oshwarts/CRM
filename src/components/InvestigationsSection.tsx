import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckSquare, FileText, History, Paperclip, Pencil, Plus, Square, Trash2, X } from 'lucide-react'
import { useAgents, useContacts, useDoctors, useHospitals, useMeetings } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { useCanDelete } from '../lib/permissions'
import { toast } from '../lib/toast'
import { classNames, formatDate, todayISO } from '../lib/utils'
import {
  openInvestigationFile,
  useDeleteInvestigation,
  useInvestigationHistory,
  useInvestigations,
  useSaveInvestigation,
  type ActionDraft,
  type Investigation,
  type InvestigationDraft,
} from '../lib/investigations'
import { ageDays, CATEGORIES, closeBlocker, lateness, SEVERITY_LABELS } from '../lib/investigationLogic'
import { ConfirmButton, EmptyState, ErrorState, Field, Modal, Spinner } from './ui'
import { normalizeHe } from '../lib/contactMatch'

const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)
const SEVERITY_TONE: Record<number, string> = { 1: 'bg-slate-100 text-slate-700', 2: 'bg-amber-100 text-amber-800', 3: 'bg-red-100 text-red-800' }

export const blankInvestigation = (defaults: Partial<InvestigationDraft> = {}): InvestigationDraft => ({
  event_date: todayISO(), title: '', problem: '', root_cause: '', solution: '', status: 'open', hospital_id: null, meeting_id: null, product: '', categories: [], severity: 2,
  doctorIds: [], contactIds: [], staffIds: [], files: [], newFiles: [], actions: [], ...defaults,
})

export const draftOf = (i: Investigation): InvestigationDraft => ({
  id: i.id, event_date: i.event_date, title: i.title, problem: i.problem, root_cause: i.root_cause, solution: i.solution, status: i.status, closedOn: i.closed_on, closedBy: i.closed_by,
  hospital_id: i.hospital_id, meeting_id: i.meeting_id, product: i.product, categories: i.categories, severity: i.severity,
  doctorIds: i.doctors.map((d) => d.id), contactIds: i.contacts.map((c) => c.id), staffIds: i.staff.map((s) => s.id),
  files: i.files, newFiles: [], baseFiles: i.files,
  actions: i.actions.map((a) => ({ id: a.id, description: a.description, assignee_id: a.assignee_id, due_date: a.due_date, is_done: a.is_done })), baseActionIds: i.actions.map((a) => a.id),
})

/** chosen people as chips with a remove button, and a search box to add more (a long list is not scannable as chips) */
function PeoplePicker({ label, options, selected, onChange }: { label: string; options: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const words = normalizeHe(q).split(' ').filter(Boolean)
  const found = words.length ? options.filter((o) => !selected.includes(o.id) && words.every((w) => normalizeHe(o.label).includes(w))).slice(0, 8) : []
  return (
    <div>
      <p className="label">{label}</p>
      {selected.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 ps-3 text-sm text-brand-800">
              <span dir="auto">{options.find((o) => o.id === id)?.label ?? '—'}</span>
              <button type="button" className="grid h-8 w-8 place-items-center" aria-label={`הסרת ${options.find((o) => o.id === id)?.label ?? ''}`} onClick={() => onChange(selected.filter((x) => x !== id))}>
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input type="search" className="input" dir="auto" placeholder="הקלד שם להוספה" aria-label={`חיפוש: ${label}`} value={q} onChange={(e) => setQ(e.target.value)} />
      {found.length > 0 && (
        <ul className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {found.map((o) => (
            <li key={o.id}>
              <button type="button" className="flex min-h-[44px] w-full items-center gap-2 px-3 text-start text-sm hover:bg-slate-50" onClick={() => (onChange([...selected, o.id]), setQ(''))}>
                <Plus size={14} aria-hidden className="text-brand-600" /> <span dir="auto">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {words.length > 0 && found.length === 0 && <p className="mt-1 text-xs text-slate-500">לא נמצא</p>}
    </div>
  )
}

/** add / edit an investigation: the story, the people, the links, the files and the corrective actions */
export function InvestigationForm({ draft, onClose }: { draft: InvestigationDraft; onClose: () => void }) {
  const save = useSaveInvestigation()
  const { isAdmin, user } = useAuth()
  const doctors = useDoctors()
  const contacts = useContacts()
  const agents = useAgents()
  const hospitals = useHospitals()
  const meetings = useMeetings()
  const [d, setD] = useState(draft)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const patch = (p: Partial<InvestigationDraft>) => setD((x) => ({ ...x, ...p }))
  const patchAction = (i: number, p: Partial<ActionDraft>) => setD((x) => ({ ...x, actions: x.actions.map((a, n) => (n === i ? { ...a, ...p } : a)) }))

  const doctorOptions = useMemo(() => (doctors.data ?? []).map((x) => ({ id: x.id, label: `${x.title} ${x.name}` })), [doctors.data])
  const contactOptions = useMemo(() => (contacts.data ?? []).map((x) => ({ id: x.id, label: x.role ? `${x.name} · ${x.role}` : x.name })), [contacts.data])
  const staffOptions = useMemo(() => (agents.data ?? []).map((x) => ({ id: x.id, label: x.full_name || x.email })), [agents.data])
  const meetingOptions = useMemo(() => (meetings.data ?? []).filter((m) => m.meeting_date).slice(0, 200), [meetings.data])

  async function submit() {
    if (busy.current) return
    if (!d.title.trim()) return setError('כתוב כותרת לתחקיר')
    const blocker = d.status === 'closed' ? closeBlocker({ ...d, openActions: d.actions.filter((a) => a.description.trim() && !a.is_done).length }) : !d.problem.trim() ? 'תאר מה הייתה הבעיה' : ''
    if (blocker) return setError(blocker)
    setError('')
    busy.current = true
    try {
      await save.mutateAsync(d)
      toast(d.id ? 'התחקיר עודכן' : 'התחקיר נוסף')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    } finally {
      busy.current = false
    }
  }

  return (
    <Modal open onClose={onClose} title={d.id ? 'עריכת תחקיר' : 'תחקיר חדש'} size="xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="כותרת" className="col-span-2">
            <input className="input" dir="auto" autoFocus value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder="למשל: תקלה בשתל בניתוח" />
          </Field>
          <Field label="תאריך האירוע" className="col-span-2 sm:col-span-1">
            <input type="date" className="input" value={d.event_date} onChange={(e) => patch({ event_date: e.target.value || todayISO() })} />
          </Field>
          <Field label="חומרה" className="col-span-1">
            <select className="input" value={d.severity} onChange={(e) => patch({ severity: Number(e.target.value) })}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{SEVERITY_LABELS[n]}</option>
              ))}
            </select>
          </Field>
          <Field label="סטטוס" className="col-span-1">
            <select className="input" value={d.status} onChange={(e) => patch({ status: e.target.value as 'open' | 'closed' })}>
              <option value="open">פתוח</option>
              <option value="closed">נסגר</option>
            </select>
          </Field>
        </div>

        <Field label="מה הייתה הבעיה?">
          <textarea className="input min-h-20" dir="auto" value={d.problem} onChange={(e) => patch({ problem: e.target.value })} />
        </Field>
        <Field label="שורש הבעיה (למה זה קרה?)">
          <textarea className="input min-h-20" dir="auto" value={d.root_cause} onChange={(e) => patch({ root_cause: e.target.value })} />
        </Field>
        <div>
          <p className="label">סוג שורש הבעיה (אפשר כמה)</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const on = d.categories.includes(c)
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => patch({ categories: on ? d.categories.filter((x) => x !== c) : [...d.categories, c] })} className={classNames('min-h-[40px] rounded-full border px-3 text-sm', on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                  {c}
                </button>
              )
            })}
          </div>
        </div>
        <Field label="הפתרון (מה עושים כדי שזה לא יחזור?)">
          <textarea className="input min-h-20" dir="auto" value={d.solution} onChange={(e) => patch({ solution: e.target.value })} />
        </Field>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">מי מעורב</legend>
          <PeoplePicker label="רופאים" options={doctorOptions} selected={d.doctorIds} onChange={(ids) => patch({ doctorIds: ids })} />
          <PeoplePicker label="אנשי קשר" options={contactOptions} selected={d.contactIds} onChange={(ids) => patch({ contactIds: ids })} />
          <PeoplePicker label="עובדי אמי טכנולוגיות" options={staffOptions} selected={d.staffIds} onChange={(ids) => patch({ staffIds: ids })} />
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="בית חולים" className="col-span-2 sm:col-span-1">
            <select className="input" value={d.hospital_id ?? ''} onChange={(e) => patch({ hospital_id: e.target.value || null })}>
              <option value="">—</option>
              {(hospitals.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="פגישה קשורה" className="col-span-2 sm:col-span-1">
            <select className="input" value={d.meeting_id ?? ''} onChange={(e) => patch({ meeting_id: e.target.value || null })}>
              <option value="">—</option>
              {meetingOptions.map((m) => (
                <option key={m.id} value={m.id}>{formatDate(m.meeting_date)} · {m.subject}</option>
              ))}
            </select>
          </Field>
          <Field label="מוצר / שתל / מק״ט" className="col-span-2">
            <input className="input" dir="auto" value={d.product} onChange={(e) => patch({ product: e.target.value })} />
          </Field>
        </div>

        <div>
          <p className="label">פעולות מתקנות ומונעות</p>
          <p className="mb-2 text-xs text-slate-500">כל פעולה נוצרת כמשימה במערכת, עם אחראי ותאריך יעד. {isAdmin ? '' : 'משימה נוצרת על שמך; מנהל יכול לשייך לאחרים.'}</p>
          <ul className="space-y-2">
            {d.actions.map((a, i) => (
              <li key={a.id ?? `n${i}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="h-6 w-6 shrink-0" checked={a.is_done} aria-label={`פעולה ${i + 1} בוצעה`} onChange={(e) => patchAction(i, { is_done: e.target.checked })} />
                  <input className="input min-w-0 flex-1" dir="auto" placeholder="תיאור הפעולה" aria-label={`תיאור פעולה ${i + 1}`} value={a.description} onChange={(e) => patchAction(i, { description: e.target.value })} />
                  <button type="button" className="btn-ghost !min-h-10 !px-2 text-red-600" aria-label={`הסרת פעולה ${i + 1}`} onClick={() => patch({ actions: d.actions.filter((_, n) => n !== i) })}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 ps-8">
                  <select className="input" aria-label={`אחראי לפעולה ${i + 1}`} disabled={!isAdmin} value={a.assignee_id ?? user?.id ?? ''} onChange={(e) => patchAction(i, { assignee_id: e.target.value || null })}>
                    {staffOptions.filter((o) => isAdmin || o.id === user?.id).map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  <input type="date" className="input" aria-label={`תאריך יעד לפעולה ${i + 1}`} value={a.due_date ?? ''} onChange={(e) => patchAction(i, { due_date: e.target.value || null })} />
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-secondary mt-2" onClick={() => patch({ actions: [...d.actions, { description: '', assignee_id: null, due_date: null, is_done: false }] })}>
            <Plus size={16} aria-hidden /> הוסף פעולה
          </button>
        </div>

        <div>
          <p className="label">קבצי התחקיר</p>
          <ul className="space-y-1.5">
            {d.files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
                <FileText size={16} aria-hidden className="shrink-0 text-slate-500" />
                <span dir="auto" className="min-w-0 flex-1 truncate">{f.file_name}</span>
                <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label={`הסרת ${f.file_name}`} onClick={() => patch({ files: d.files.filter((x) => x.id !== f.id) })}>
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
            {d.newFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm">
                <FileText size={16} aria-hidden className="shrink-0 text-brand-600" />
                <span dir="auto" className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-slate-500">חדש · {sizeLabel(f.size)}</span>
                <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label={`הסרת ${f.name}`} onClick={() => patch({ newFiles: d.newFiles.filter((_, n) => n !== i) })}>
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-secondary mt-2" onClick={() => fileInput.current?.click()}>
            <Paperclip size={16} aria-hidden /> העלאת קובץ
          </button>
          <input ref={fileInput} type="file" hidden multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={(e) => (patch({ newFiles: [...d.newFiles, ...Array.from(e.target.files ?? [])] }), (e.target.value = ''))} />
          <p className="mt-1 text-xs text-slate-500">כמה קבצים, עד 50MB לקובץ. אפשר גם בלי.</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
          <button type="button" className="btn-primary max-sm:flex-1" disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function InvestigationHistory({ id }: { id: string }) {
  const h = useInvestigationHistory(id, true)
  if (h.isLoading) return <p className="text-xs text-slate-500">טוען…</p>
  if (!h.data?.length) return <p className="text-xs text-slate-500">אין היסטוריה</p>
  return (
    <ul className="space-y-0.5 text-xs text-slate-600">
      {h.data.map((e) => (
        <li key={e.id}>
          {formatDate(e.at)} · {e.user_name || 'מערכת'} · {e.action === 'insert' ? 'נוצר' : e.action === 'delete' ? 'נמחק' : `עודכן${e.changed_fields?.length ? ` (${e.changed_fields.length} שדות)` : ''}`}
        </li>
      ))}
    </ul>
  )
}

/** one investigation: the story, who is involved, the links, the files and the corrective actions */
export function InvestigationCard({ i, onEdit, showDoctors = true }: { i: Investigation; onEdit: (i: Investigation) => void; showDoctors?: boolean }) {
  const del = useDeleteInvestigation()
  const canDelete = useCanDelete()
  const { isAdmin } = useAuth()
  const agents = useAgents()
  const [history, setHistory] = useState(false)
  const today = todayISO()
  const late = lateness(i, today)
  const nameOf = (id: string | null) => (agents.data ?? []).find((a) => a.id === id)?.full_name ?? ''
  const people = [
    ...(showDoctors ? i.doctors.map((d) => ({ key: `d${d.id}`, label: `${d.title} ${d.name}`, to: `/doctors/${d.id}` })) : []),
    ...i.contacts.map((c) => ({ key: `c${c.id}`, label: c.role ? `${c.name} · ${c.role}` : c.name, to: '' })),
    ...i.staff.map((s) => ({ key: `s${s.id}`, label: `${s.full_name} (אמי)`, to: '' })),
  ]
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="auto" className="font-semibold text-slate-800 [overflow-wrap:anywhere]">{i.title}</p>
          <p className="text-xs text-slate-500">
            {formatDate(i.event_date)}
            {i.status === 'closed' && i.closed_on ? ` · נסגר ב-${formatDate(i.closed_on)} (אחרי ${ageDays(i, today)} ימים)` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={classNames('rounded-full px-2.5 py-0.5 text-xs font-medium', SEVERITY_TONE[i.severity])}>חומרה {SEVERITY_LABELS[i.severity]}</span>
          {i.status === 'open' && late !== 'ok' && (
            <span className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', late === 'very-late' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')}>
              <AlertTriangle size={12} aria-hidden /> פתוח {ageDays(i, today)} ימים
            </span>
          )}
          <span className={classNames('rounded-full px-2.5 py-0.5 text-xs font-medium', i.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800')}>{i.status === 'open' ? 'פתוח' : 'נסגר'}</span>
        </div>
      </div>

      {(people.length > 0 || i.hospital || i.meeting || i.product) && (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {people.map((p) => (
            <li key={p.key}>
              {p.to ? (
                <Link to={p.to} className="inline-flex min-h-[28px] items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 text-brand-800 hover:underline"><span dir="auto">{p.label}</span></Link>
              ) : (
                <span className="inline-flex min-h-[28px] items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-slate-700"><span dir="auto">{p.label}</span></span>
              )}
            </li>
          ))}
          {i.hospital && <li><Link to={`/hospitals/${i.hospital.id}`} className="inline-flex min-h-[28px] items-center rounded-full border border-slate-200 bg-white px-2.5 text-slate-700 hover:underline"><span dir="auto">{i.hospital.name}</span></Link></li>}
          {i.meeting && <li><Link to={`/meetings/${i.meeting.id}`} className="inline-flex min-h-[28px] items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 text-sky-700 hover:underline">פגישה: <span dir="auto" className="ms-1 max-w-[12rem] truncate">{i.meeting.subject}</span></Link></li>}
          {i.product && <li><span dir="auto" className="inline-flex min-h-[28px] items-center rounded-full border border-slate-200 bg-white px-2.5 text-slate-700">מוצר: {i.product}</span></li>}
        </ul>
      )}
      {i.categories.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {i.categories.map((c) => (
            <li key={c} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs text-violet-700">{c}</li>
          ))}
        </ul>
      )}

      <dl className="mt-2 space-y-1.5 text-sm">
        {([['הבעיה', i.problem], ['שורש הבעיה', i.root_cause], ['הפתרון', i.solution]] as const).map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-medium text-slate-500">{k}</dt>
            <dd dir="auto" className="whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{v || <span className="text-slate-400">עדיין לא מולא</span>}</dd>
          </div>
        ))}
      </dl>

      {i.actions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-slate-500">פעולות מתקנות ({i.actions.filter((a) => a.is_done).length}/{i.actions.length})</p>
          <ul className="space-y-0.5 text-sm">
            {i.actions.map((a) => (
              <li key={a.id} className="flex items-start gap-1.5">
                {a.is_done ? <CheckSquare size={16} aria-hidden className="mt-0.5 shrink-0 text-emerald-600" /> : <Square size={16} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />}
                <span dir="auto" className={classNames('min-w-0 [overflow-wrap:anywhere]', a.is_done && 'text-slate-400 line-through')}>{a.description}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {nameOf(a.assignee_id)}
                  {a.due_date ? ` · עד ${formatDate(a.due_date)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {i.files.map((f) => (
          <button
            key={f.id}
            type="button"
            className="btn-secondary"
            onClick={async () => {
              const err = await openInvestigationFile(f)
              if (err) toast(err, { kind: 'error' })
            }}
          >
            <FileText size={16} aria-hidden />
            <span dir="auto" className="max-w-[10rem] truncate">{f.file_name || 'קובץ'}</span>
            <span className="text-xs text-slate-500">{sizeLabel(f.file_size)}</span>
          </button>
        ))}
        <button type="button" className="btn-secondary" onClick={() => onEdit(i)}>
          <Pencil size={16} aria-hidden /> עריכה
        </button>
        {isAdmin && (
          <button type="button" className="btn-ghost" aria-expanded={history} onClick={() => setHistory((v) => !v)}>
            <History size={16} aria-hidden /> היסטוריה
          </button>
        )}
        {canDelete(i.created_by) && (
          <ConfirmButton className="btn-ghost !text-red-600" message={`למחוק את התחקיר "${i.title}" ואת הקבצים שלו? אי אפשר לבטל.`} label={`מחיקת התחקיר ${i.title}`} onConfirm={() => del.mutate(i)}>
            <Trash2 size={16} aria-hidden /> מחיקה
          </ConfirmButton>
        )}
      </div>
      {history && <div className="mt-2 border-t border-slate-100 pt-2"><InvestigationHistory id={i.id} /></div>}
    </li>
  )
}

/** the investigations tab of a doctor */
export function InvestigationsSection({ doctorId }: { doctorId: string }) {
  const list = useInvestigations(doctorId)
  const [draft, setDraft] = useState<InvestigationDraft | null>(null)
  const sorted = useMemo(() => [...(list.data ?? [])].sort((a, b) => (a.status === b.status ? b.event_date.localeCompare(a.event_date) : a.status === 'open' ? -1 : 1)), [list.data])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-600">{list.data?.length ?? 0} תחקירים</h2>
        <div className="flex gap-2">
          <Link to="/investigations" className="btn-ghost">לכל התחקירים</Link>
          <button className="btn-secondary" onClick={() => setDraft(blankInvestigation({ doctorIds: [doctorId] }))}>
            <Plus size={16} aria-hidden /> תחקיר חדש
          </button>
        </div>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : sorted.length === 0 ? (
        <EmptyState title="אין תחקירים לרופא הזה" hint="תחקיר מתעד בעיה שהייתה, את שורש הבעיה, את הפתרון ואת הפעולות המתקנות, ואפשר לצרף אליו קבצים." />
      ) : (
        <ul className="space-y-3">
          {sorted.map((i) => (
            <InvestigationCard key={i.id} i={i} onEdit={(x) => setDraft(draftOf(x))} />
          ))}
        </ul>
      )}
      {draft && <InvestigationForm draft={draft} onClose={() => setDraft(null)} />}
    </div>
  )
}
