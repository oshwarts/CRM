import { useState } from 'react'
import { useProceduresRaw } from '../lib/api'
import { groupParentIds, useCreateProcedureRequest } from '../lib/procedures'
import { toast } from '../lib/toast'
import { Field, Modal } from './ui'

/** an agent asks for a procedure that is missing from the list; a manager approves it in Settings (optionally as a sub-procedure of another) */
export function ProcedureRequestModal({ onClose, doctorId, doctorName }: { onClose: () => void; doctorId?: string; doctorName?: string }) {
  const procedures = useProceduresRaw()
  const create = useCreateProcedureRequest()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  // only a procedure that is not itself a sub-procedure can be a parent
  const parents = (procedures.data ?? []).filter((p) => !p.parent_id)
  const withChildren = groupParentIds(procedures.data ?? [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('כתוב את שם ההליך')
    setError('')
    create.mutate(
      { name, parent_id: parentId || null, doctor_id: doctorId ?? null, note },
      {
        onSuccess: () => {
          toast('הבקשה נשלחה למנהל')
          onClose()
        },
        onError: () => setError('שליחת הבקשה נכשלה, נסה שוב'),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="בקשה להליך חדש" size="md">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          ההליך לא ברשימה? שלח בקשה והמנהל יוסיף אותו.
          {doctorName ? ` אחרי האישור הוא יתווסף גם ל${doctorName}.` : ''}
        </p>
        <Field label="שם ההליך">
          <input className="input" autoFocus enterKeyHint="next" placeholder="לדוגמה: GMRS – ברך" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="תת-הליך של (לא חובה)">
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">הליך עצמאי</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {withChildren.has(p.id) ? ' (יש לו כבר תתי-הליכים)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="הערה למנהל (לא חובה)">
          <textarea className="input min-h-[72px]" dir="auto" placeholder="למה צריך אותו, מי מבצע אותו…" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn-primary max-sm:flex-1" disabled={create.isPending}>
            {create.isPending ? 'שולח…' : 'שלח בקשה'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
