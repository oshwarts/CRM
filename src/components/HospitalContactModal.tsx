import { useState } from 'react'
import { useUpsertContact } from '../lib/api'
import { CONTACT_ROLES } from '../lib/types'
import { Field, Modal } from './ui'
import { ImportContactButton } from './ImportContactButton'

/** adds a contact to a hospital (procurement, imaging institute, secretary…) — no doctor needed */
export function HospitalContactModal({
  hospitalId,
  hospitalName,
  onClose,
}: {
  hospitalId: string
  hospitalName: string
  onClose: () => void
}) {
  const upsert = useUpsertContact()
  const [d, setD] = useState({ name: '', role: '', phone: '', office_phone: '', email: '', notes: '' })
  const [error, setError] = useState('')
  const set = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }))

  async function save() {
    if (!d.name.trim()) return setError('הזן שם לאיש הקשר')
    setError('')
    try {
      await upsert.mutateAsync({
        name: d.name.trim(),
        role: d.role.trim(),
        phone: d.phone.trim(),
        office_phone: d.office_phone.trim(),
        email: d.email.trim(),
        notes: d.notes.trim(),
        hospital_id: hospitalId,
        doctor_id: null,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={`איש קשר חדש – ${hospitalName}`} size="md">
      <div className="space-y-3">
        <ImportContactButton
          onPick={(c) =>
            set({ name: d.name || c.name, phone: c.phone || d.phone, email: c.email || d.email })
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="שם">
            <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <Field label="תפקיד">
            <input className="input" list="hospital-contact-roles" placeholder="בחר מהרשימה או כתוב תפקיד חופשי" value={d.role} onChange={(e) => set({ role: e.target.value })} />
            <datalist id="hospital-contact-roles">
              {CONTACT_ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field label="טלפון">
            <input dir="ltr" className="input text-right" value={d.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="טלפון נוסף במשרד">
            <input dir="ltr" className="input text-right" value={d.office_phone} onChange={(e) => set({ office_phone: e.target.value })} />
          </Field>
          <Field label="אימייל">
            <input dir="ltr" className="input text-right" value={d.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="הערות" className="sm:col-span-2">
            <input className="input" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
        <p className="text-xs text-slate-400">איש הקשר ישויך לבית החולים בלבד, בלי רופא מסוים.</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" onClick={save} disabled={upsert.isPending}>
            שמירה
          </button>
        </div>
      </div>
    </Modal>
  )
}
