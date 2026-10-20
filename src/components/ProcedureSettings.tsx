import { useState } from 'react'
import { Check, Pencil, Plus, Stethoscope, Trash2, X } from 'lucide-react'
import { useDeleteProcedure, useProceduresRaw, useUpsertProcedure } from '../lib/api'
import { groupParentIds, procedureGroups, useDecideProcedureRequest, useProcedureRequests, type ProcedureRequest } from '../lib/procedures'
import { PROCEDURE_CATEGORY_LABELS, type Procedure } from '../lib/types'
import { toast } from '../lib/toast'
import { formatDate } from '../lib/utils'
import { ConfirmButton, Field, Modal, Spinner } from './ui'
import { EmptyRow } from './SettingsKit'

const errText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '')

/** the procedures: one level of sub-procedures under a parent (GMRS with its options), and the requests of the agents for new ones */
export function ProceduresSettings() {
  const procedures = useProceduresRaw()
  const upsert = useUpsertProcedure()
  const del = useDeleteProcedure()
  const [form, setForm] = useState({ name: '', category: 'knee', is_mako: false, parent_id: '' })
  const [editing, setEditing] = useState<Procedure | null>(null)
  const list = procedures.data ?? []
  const parents = list.filter((p) => !p.parent_id)

  function remove(p: Procedure) {
    del.mutate(p.id, {
      onError: (e) => toast(/foreign key|violates/i.test(errText(e)) ? 'אי אפשר למחוק הליך שיש לו תתי-הליכים: קודם מוחקים או מעבירים אותם' : 'המחיקה נכשלה', { kind: 'error' }),
    })
  }

  const row = (p: Procedure, child: boolean) => (
    <li key={p.id} className={`flex items-center gap-1 py-1.5 text-sm ${child ? 'mr-5 border-r-2 border-slate-200 pr-2' : ''}`}>
      <span className="min-w-0 flex-1 text-slate-800">
        <span className={`[overflow-wrap:anywhere] ${child ? '' : 'font-medium'}`}>{p.name}</span>
        <span className="block text-xs text-slate-500">
          {PROCEDURE_CATEGORY_LABELS[p.category] ?? p.category}
          {p.is_mako ? ' · MAKO' : ''}
        </span>
      </span>
      <button type="button" className="btn-ghost !px-2" aria-label={`עריכת ${p.name}`} onClick={() => setEditing(p)}>
        <Pencil size={16} />
      </button>
      <ConfirmButton className="btn-ghost !px-2 text-red-600" label={`מחק את ${p.name}`} onConfirm={() => remove(p)}>
        <Trash2 size={16} />
      </ConfirmButton>
    </li>
  )

  return (
    <div className="space-y-4">
      <ProcedureRequestsPanel />
      <div className="card space-y-4 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-800">הליכים</h2>
          <span className="text-sm text-slate-500">{list.length} הליכים</span>
        </div>
        <p className="text-xs text-slate-500">הליך יכול לכלול תתי-הליכים (רמה אחת), לדוגמה GMRS עם האפשרויות שלו. ברופא, בסריקה ובמסמך בוחרים את תת-ההליך; סינון לפי הליך אב כולל את כל תתיו.</p>
        <form
          className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.name.trim()) return
            upsert.mutate(
              { name: form.name.trim(), category: form.category, is_mako: form.is_mako, parent_id: form.parent_id || null },
              { onSuccess: () => setForm({ ...form, name: '' }), onError: () => toast('ההוספה נכשלה', { kind: 'error' }) },
            )
          }}
        >
          <input className="input" aria-label="שם ההליך" enterKeyHint="done" placeholder="שם ההליך החדש" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:contents">
            <select className="input" aria-label="קטגוריה" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(PROCEDURE_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <label className="flex min-h-[40px] items-center gap-2 px-1 text-sm text-slate-700">
              <input type="checkbox" className="h-5 w-5" checked={form.is_mako} onChange={(e) => setForm({ ...form, is_mako: e.target.checked })} />
              MAKO
            </label>
          </div>
          <button className="btn-primary" disabled={!form.name.trim() || upsert.isPending}>
            <Plus size={16} aria-hidden />
            הוסף הליך
          </button>
          <select className="input sm:col-span-4" aria-label="תת-הליך של" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">הליך עצמאי (לא תת-הליך)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                תת-הליך של: {p.name}
              </option>
            ))}
          </select>
        </form>
        {procedures.isLoading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-slate-100">
            {procedureGroups(list).map(({ parent, children }) => (
              <li key={parent.id} className="list-none">
                <ul>
                  {row(parent, false)}
                  {children.map((c) => row(c, true))}
                </ul>
              </li>
            ))}
            {list.length === 0 && <EmptyRow>עוד לא הוגדרו הליכים.</EmptyRow>}
          </ul>
        )}
      </div>
      {editing && <ProcedureEditModal procedure={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ProcedureEditModal({ procedure, onClose }: { procedure: Procedure; onClose: () => void }) {
  const procedures = useProceduresRaw()
  const upsert = useUpsertProcedure()
  const [f, setF] = useState({ name: procedure.name, category: procedure.category, is_mako: procedure.is_mako, parent_id: procedure.parent_id ?? '' })
  const list = procedures.data ?? []
  const hasChildren = groupParentIds(list).has(procedure.id)
  // a parent cannot move under another procedure, and only a procedure that is not itself a sub-procedure can be a parent
  const parents = list.filter((p) => !p.parent_id && p.id !== procedure.id)

  return (
    <Modal open onClose={onClose} title="עריכת הליך" size="md">
      <div className="space-y-3">
        <Field label="שם ההליך">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="קטגוריה">
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {Object.entries(PROCEDURE_CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex min-h-[40px] items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-5 w-5" checked={f.is_mako} onChange={(e) => setF({ ...f, is_mako: e.target.checked })} />
          הליך MAKO
        </label>
        <Field label="תת-הליך של">
          <select className="input" disabled={hasChildren} value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}>
            <option value="">הליך עצמאי</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {hasChildren && <p className="text-xs text-slate-500">להליך הזה יש תתי-הליכים, לכן אי אפשר להפוך אותו לתת-הליך.</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button
            type="button"
            className="btn-primary max-sm:flex-1"
            disabled={!f.name.trim() || upsert.isPending}
            onClick={() =>
              upsert.mutate(
                { id: procedure.id, name: f.name.trim(), category: f.category, is_mako: f.is_mako, parent_id: f.parent_id || null },
                { onSuccess: onClose, onError: () => toast('השמירה נכשלה', { kind: 'error' }) },
              )
            }
          >
            שמירה
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** managers: the requests waiting for a decision (edit the name or the parent, then approve or reject); everybody: the answers to their own */
export function ProcedureRequestsPanel() {
  const q = useProcedureRequests()
  const decide = useDecideProcedureRequest()
  const procedures = useProceduresRaw()
  const [deciding, setDeciding] = useState<ProcedureRequest | null>(null)
  const rows = q.data ?? []
  const pending = rows.filter((r) => r.status === 'pending')
  if (q.isLoading || pending.length === 0) return null

  function reject(r: ProcedureRequest) {
    const note = window.prompt(`לדחות את הבקשה להליך "${r.name}"? אפשר לכתוב סיבה (לא חובה):`, '')
    if (note === null) return
    decide.mutate({ id: r.id, approve: false, note }, { onSuccess: () => toast('הבקשה נדחתה'), onError: () => toast('הפעולה נכשלה', { kind: 'error' }) })
  }

  return (
    <section className="card border-amber-200 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
        <Stethoscope size={16} className="text-amber-600" aria-hidden />
        בקשות להליך חדש ({pending.length})
      </h2>
      <ul className="divide-y divide-slate-100">
        {pending.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <div className="min-w-0 flex-1 basis-48">
              <p dir="auto" className="font-medium text-slate-800 [overflow-wrap:anywhere]">
                {r.name}
                {r.parent ? <span className="font-normal text-slate-500"> · תת-הליך של {r.parent.name}</span> : ''}
              </p>
              <p className="text-xs text-slate-500">
                {[r.requester?.full_name, r.doctor ? `עבור ${r.doctor.title} ${r.doctor.name}` : '', formatDate(r.created_at.slice(0, 10))].filter(Boolean).join(' · ')}
              </p>
              {r.note && (
                <p dir="auto" className="mt-0.5 text-xs text-slate-600 [overflow-wrap:anywhere]">
                  {r.note}
                </p>
              )}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-1.5">
              <button type="button" className="btn-primary" disabled={decide.isPending} onClick={() => setDeciding(r)}>
                <Check size={15} /> אשר
              </button>
              <button type="button" className="btn-secondary" disabled={decide.isPending} onClick={() => reject(r)}>
                <X size={15} /> דחה
              </button>
            </div>
          </li>
        ))}
      </ul>
      {deciding && <ApproveModal request={deciding} parents={(procedures.data ?? []).filter((p) => !p.parent_id)} onClose={() => setDeciding(null)} />}
    </section>
  )
}

function ApproveModal({ request, parents, onClose }: { request: ProcedureRequest; parents: Procedure[]; onClose: () => void }) {
  const decide = useDecideProcedureRequest()
  const [name, setName] = useState(request.name)
  const [parent, setParent] = useState(request.parent_id ?? '')
  return (
    <Modal open onClose={onClose} title="אישור הליך חדש" size="md">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">אפשר לתקן את השם ואת ההליך שתחתיו הוא יופיע לפני האישור.{request.doctor ? ` ההליך יתווסף גם ל${request.doctor.title} ${request.doctor.name}.` : ''}</p>
        <Field label="שם ההליך">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="תת-הליך של">
          <select className="input" value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">הליך עצמאי</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button
            type="button"
            className="btn-primary max-sm:flex-1"
            disabled={!name.trim() || decide.isPending}
            onClick={() =>
              decide.mutate(
                { id: request.id, approve: true, name: name.trim(), parent: parent || null },
                { onSuccess: () => { toast('ההליך נוסף לרשימה'); onClose() }, onError: () => toast('האישור נכשל', { kind: 'error' }) },
              )
            }
          >
            אשר והוסף
          </button>
        </div>
      </div>
    </Modal>
  )
}
