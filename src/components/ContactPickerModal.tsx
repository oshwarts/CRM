import { useState } from 'react'
import { useContacts } from '../lib/api'
import { Field, Modal } from './ui'

export type ContactChoice = { contactId: string | null; text: string }

/** choose one contact (or an outside party written as text) to put on several tasks at once */
export function ContactPickerModal({
  title,
  hospitalId,
  initial,
  hint,
  extra,
  confirmLabel = 'החל',
  onConfirm,
  onClose,
}: {
  title: string
  hospitalId: string | null
  initial?: ContactChoice
  hint?: string
  /** optional extra control under the fields (e.g. "apply to tasks that already have a contact") */
  extra?: (state: { overwrite: boolean; setOverwrite: (v: boolean) => void }) => React.ReactNode
  confirmLabel?: string
  onConfirm: (c: ContactChoice, overwrite: boolean) => Promise<void> | void
  onClose: () => void
}) {
  const contacts = useContacts()
  const [contactId, setContactId] = useState(initial?.contactId ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const list = (contacts.data ?? []).filter((c) => !hospitalId || c.hospital_id === hospitalId)

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await onConfirm({ contactId: contactId || null, text: contactId ? '' : text.trim() }, overwrite)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'הפעולה נכשלה')
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={title} size="md">
      <div className="space-y-3">
        {hint && <p className="text-sm text-slate-500">{hint}</p>}
        <Field label="איש קשר מבית החולים">
          <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">— בלי איש קשר —</option>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.role ? ` · ${c.role}` : ''}
                {c.phone ? ` · ${c.phone}` : ''}
                {c.office_phone ? ` · משרד ${c.office_phone}` : ''}
              </option>
            ))}
          </select>
        </Field>
        {!contactId && (
          <Field label="או גורם חיצוני (טקסט חופשי)">
            <input className="input" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder="למשל: חברת חשמל חיצונית" />
          </Field>
        )}
        {list.length === 0 && <p className="text-xs text-amber-600">אין אנשי קשר לבית החולים של הפרויקט. אפשר להוסיף במפה ← בית החולים ← "הוסף איש קשר".</p>}
        {extra?.({ overwrite, setOverwrite })}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'שומר…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
