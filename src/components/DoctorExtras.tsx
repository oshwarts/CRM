import { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from '../lib/toast'
import { classNames } from '../lib/utils'
import {
  FUNDS,
  INSURERS,
  KIND_LABELS,
  useAddArrangement,
  useArrangements,
  useDeleteRole,
  useDoctorRoles,
  useRemoveArrangement,
  useSaveRole,
  type DoctorRole,
} from '../lib/doctorExtras'
import { ConfirmButton, Field, Modal } from './ui'

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'השמירה נכשלה', { kind: 'error' })

/** the health funds and private insurers a doctor of a private hospital has an arrangement with: tap the usual ones, or type another */
function Arrangements({ doctorId }: { doctorId: string }) {
  const list = useArrangements(doctorId)
  const add = useAddArrangement(doctorId)
  const remove = useRemoveArrangement(doctorId)
  const [other, setOther] = useState('')
  const items = list.data ?? []
  const has = (name: string) => items.find((a) => a.provider === name)
  const toggle = (name: string) => {
    const a = has(name)
    if (a) remove.mutate(a.id, { onError: fail })
    else add.mutate(name, { onError: fail })
  }
  const chip = (name: string) => {
    const on = !!has(name)
    return (
      <button key={name} type="button" aria-pressed={on} onClick={() => toggle(name)} className={classNames('min-h-[40px] rounded-full border px-3 text-sm font-medium', on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
        {name}
      </button>
    )
  }
  const customs = items.filter((a) => a.kind === 'other')

  return (
    <section aria-label="הסדרים עם קופות חולים וביטוחים" className="card space-y-3 p-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">הסדרים עם קופות חולים וביטוחים</h2>
        <p className="text-xs text-slate-500">לרופא שעובד בבית חולים פרטי: עם אילו קופות וחברות ביטוח יש לו הסדר</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">{KIND_LABELS.fund}</p>
        <div className="flex flex-wrap gap-1.5">{FUNDS.map(chip)}</div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">{KIND_LABELS.insurer}</p>
        <div className="flex flex-wrap gap-1.5">{INSURERS.map(chip)}</div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">אחר</p>
        {customs.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {customs.map((a) => (
              <li key={a.id} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 ps-3 text-sm text-brand-800">
                <span dir="auto">{a.provider}</span>
                <button type="button" className="grid h-10 w-10 place-items-center" aria-label={`הסרת ${a.provider}`} onClick={() => remove.mutate(a.id, { onError: fail })}>
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!other.trim()) return
            add.mutate(other, { onSuccess: () => setOther(''), onError: fail })
          }}
        >
          <input className="input min-w-0 flex-1" dir="auto" aria-label="קופה או ביטוח נוספים" placeholder="קופה או חברת ביטוח אחרת…" value={other} onChange={(e) => setOther(e.target.value)} />
          <button className="btn-secondary shrink-0" disabled={!other.trim() || add.isPending}>
            <Plus size={16} aria-hidden /> הוסף
          </button>
        </form>
      </div>
    </section>
  )
}

/** further roles of the doctor: chair of a society, head of a committee, a lecturer… */
function Roles({ doctorId }: { doctorId: string }) {
  const list = useDoctorRoles(doctorId)
  const save = useSaveRole(doctorId)
  const del = useDeleteRole(doctorId)
  const [editing, setEditing] = useState<Partial<DoctorRole> | null>(null)
  const items = list.data ?? []
  return (
    <section aria-label="תפקידים נוספים" className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">תפקידים נוספים</h2>
          <p className="text-xs text-slate-500">למשל יו״ר האגודה, חבר ועדה, מרצה</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setEditing({ title: '', organization: '', note: '' })}>
          <Plus size={16} aria-hidden /> הוסף תפקיד
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">לא נוספו תפקידים.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
              <div className="min-w-0 flex-1 basis-48">
                <p dir="auto" className="break-words text-sm font-medium text-slate-800">{r.title}</p>
                {r.organization && <p dir="auto" className="break-words text-sm text-slate-600">{r.organization}</p>}
                {r.note && <p dir="auto" className="text-xs text-slate-500 [overflow-wrap:anywhere]">{r.note}</p>}
              </div>
              <div className="flex shrink-0">
                <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label={`עריכת ${r.title}`} onClick={() => setEditing(r)}>
                  <Pencil size={16} aria-hidden />
                </button>
                <ConfirmButton className="btn-ghost !min-h-10 !px-2 !text-red-600" message={`למחוק את התפקיד "${r.title}"?`} label={`מחיקת ${r.title}`} onConfirm={() => del.mutate(r.id, { onError: fail })}>
                  <Trash2 size={16} aria-hidden />
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'עריכת תפקיד' : 'תפקיד חדש'} size="md">
          <RoleForm initial={editing} saving={save.isPending} onCancel={() => setEditing(null)} onSave={(r) => save.mutate({ ...r, sort: editing.sort ?? items.length }, { onSuccess: () => setEditing(null), onError: fail })} />
        </Modal>
      )}
    </section>
  )
}

function RoleForm({ initial, saving, onCancel, onSave }: { initial: Partial<DoctorRole>; saving: boolean; onCancel: () => void; onSave: (r: { id?: string; title: string; organization: string; note: string }) => void }) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [organization, setOrganization] = useState(initial.organization ?? '')
  const [note, setNote] = useState(initial.note ?? '')
  const [error, setError] = useState('')
  return (
    <div className="space-y-3">
      <Field label="תפקיד">
        <input className="input" dir="auto" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: יו״ר האגודה" />
      </Field>
      <Field label="גוף או ארגון (לא חובה)">
        <input className="input" dir="auto" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="למשל: האגודה הישראלית לאורתופדיה" />
      </Field>
      <Field label="הערה (לא חובה)">
        <input className="input" dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: מאז 2024" />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
        <button type="button" className="btn-primary max-sm:flex-1" disabled={saving} onClick={() => (title.trim() ? onSave({ id: initial.id, title, organization, note }) : setError('כתוב את התפקיד'))}>
          שמירה
        </button>
      </div>
    </div>
  )
}

/** the arrangements (for a doctor of a private hospital, or one that already has some) and the further roles, on the details of the doctor */
export function DoctorExtras({ doctorId, privateHospital }: { doctorId: string; privateHospital: boolean }) {
  const arrangements = useArrangements(doctorId)
  const show = privateHospital || (arrangements.data ?? []).length > 0
  return (
    <div className="space-y-4">
      {show && <Arrangements doctorId={doctorId} />}
      <Roles doctorId={doctorId} />
      {!show && <p className="text-xs text-slate-500">הסדרים עם קופות חולים וביטוחים מופיעים לרופא ששויך לבית חולים פרטי.</p>}
    </div>
  )
}
