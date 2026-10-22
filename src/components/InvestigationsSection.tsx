import { useRef, useState } from 'react'
import { FileText, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCanDelete } from '../lib/permissions'
import { toast } from '../lib/toast'
import { classNames, formatDate } from '../lib/utils'
import {
  openInvestigationFile,
  useDeleteInvestigation,
  useInvestigations,
  useSaveInvestigation,
  type Investigation,
  type InvestigationDraft,
} from '../lib/investigations'
import { ConfirmButton, EmptyState, ErrorState, Field, Modal, Spinner } from './ui'

const todayISO = () => new Date().toLocaleDateString('sv-SE')
const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)

const blank = (doctorId: string): InvestigationDraft => ({ doctor_id: doctorId, event_date: todayISO(), title: '', problem: '', root_cause: '', solution: '', status: 'open' })

/** an investigation: there was a problem, why it happened (the root cause), what the solution is, and the investigation file */
function InvestigationForm({ draft, onClose }: { draft: InvestigationDraft; onClose: () => void }) {
  const save = useSaveInvestigation()
  const [d, setD] = useState(draft)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const patch = (p: Partial<InvestigationDraft>) => setD((x) => ({ ...x, ...p }))
  const hasFile = !!d.file || (!!d.existing?.file_path && !d.removeFile)

  async function submit() {
    if (busy.current) return
    if (!d.title.trim()) return setError('כתוב כותרת לתחקיר')
    if (!d.problem.trim()) return setError('תאר מה הייתה הבעיה')
    // a closed investigation is one that has understood the problem, found the root cause and has a solution
    if (d.status === 'closed' && (!d.root_cause.trim() || !d.solution.trim())) return setError('כדי לסגור תחקיר צריך למלא גם שורש הבעיה וגם פתרון')
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
    <Modal open onClose={onClose} title={d.id ? 'עריכת תחקיר' : 'תחקיר חדש'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="כותרת" className="col-span-2">
            <input className="input" dir="auto" autoFocus value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder="למשל: תקלה בשתל בניתוח" />
          </Field>
          <Field label="תאריך האירוע" className="col-span-2 sm:col-span-1">
            <input type="date" className="input" value={d.event_date} onChange={(e) => patch({ event_date: e.target.value || todayISO() })} />
          </Field>
          <Field label="סטטוס" className="col-span-2 sm:col-span-1">
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
        <Field label="הפתרון (מה עושים כדי שזה לא יחזור?)">
          <textarea className="input min-h-20" dir="auto" value={d.solution} onChange={(e) => patch({ solution: e.target.value })} />
        </Field>
        <div>
          <p className="label">קובץ התחקיר</p>
          {hasFile ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <FileText size={16} aria-hidden className="shrink-0 text-slate-500" />
              <span dir="auto" className="min-w-0 flex-1 truncate">{d.file?.name ?? d.existing?.file_name}</span>
              <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label="הסרת הקובץ" onClick={() => patch({ file: null, removeFile: true })}>
                <X size={16} aria-hidden />
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
              <Paperclip size={16} aria-hidden /> העלאת קובץ
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) patch({ file: f, removeFile: false })
              e.target.value = ''
            }}
          />
          <p className="mt-1 text-xs text-slate-500">עד 50MB. אפשר גם בלי קובץ.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-primary max-sm:flex-1" disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function InvestigationsSection({ doctorId }: { doctorId: string }) {
  const list = useInvestigations(doctorId)
  const del = useDeleteInvestigation()
  const canDelete = useCanDelete()
  const [draft, setDraft] = useState<InvestigationDraft | null>(null)

  const edit = (i: Investigation): InvestigationDraft => ({
    id: i.id, doctor_id: i.doctor_id, event_date: i.event_date, title: i.title, problem: i.problem, root_cause: i.root_cause, solution: i.solution,
    status: i.status, closedOn: i.closed_on, existing: { file_path: i.file_path, file_name: i.file_name, file_size: i.file_size, mime: i.mime },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-600">{list.data?.length ?? 0} תחקירים</h2>
        <button className="btn-secondary" onClick={() => setDraft(blank(doctorId))}>
          <Plus size={16} aria-hidden /> תחקיר חדש
        </button>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="אין תחקירים לרופא הזה" hint="תחקיר מתעד בעיה שהייתה, את שורש הבעיה ואת הפתרון, ואפשר לצרף אליו את קובץ התחקיר." />
      ) : (
        <ul className="space-y-3">
          {(list.data ?? []).map((i) => (
            <li key={i.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p dir="auto" className="font-semibold text-slate-800 [overflow-wrap:anywhere]">{i.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(i.event_date)}
                    {i.status === 'closed' && i.closed_on ? ` · נסגר ב-${formatDate(i.closed_on)}` : ''}
                  </p>
                </div>
                <span className={classNames('rounded-full px-2.5 py-0.5 text-xs font-medium', i.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800')}>
                  {i.status === 'open' ? 'פתוח' : 'נסגר'}
                </span>
              </div>
              <dl className="mt-2 space-y-1.5 text-sm">
                {([['הבעיה', i.problem], ['שורש הבעיה', i.root_cause], ['הפתרון', i.solution]] as const).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-medium text-slate-500">{k}</dt>
                    <dd dir="auto" className="whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{v || <span className="text-slate-400">עדיין לא מולא</span>}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {i.file_path && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      const err = await openInvestigationFile(i)
                      if (err) toast(err, { kind: 'error' })
                    }}
                  >
                    <FileText size={16} aria-hidden />
                    <span dir="auto" className="max-w-[12rem] truncate">{i.file_name || 'קובץ התחקיר'}</span>
                    <span className="text-xs text-slate-500">{sizeLabel(i.file_size)}</span>
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => setDraft(edit(i))}>
                  <Pencil size={16} aria-hidden /> עריכה
                </button>
                {canDelete(i.created_by) && (
                  <ConfirmButton className="btn-ghost !text-red-600" message={`למחוק את התחקיר "${i.title}" ואת הקובץ שלו? אי אפשר לבטל.`} label={`מחיקת התחקיר ${i.title}`} onConfirm={() => del.mutate(i)}>
                    <Trash2 size={16} aria-hidden /> מחיקה
                  </ConfirmButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {draft && <InvestigationForm draft={draft} onClose={() => setDraft(null)} />}
    </div>
  )
}
