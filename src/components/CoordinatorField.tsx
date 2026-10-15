import { useContacts } from '../lib/api'
import { Field } from './ui'

/** "AMI coordinator" of a task: a contact from the system, free text, or both */
export function CoordinatorField({
  contactId,
  text,
  onChange,
}: {
  contactId: string | null
  text: string
  onChange: (p: { coordinator_contact_id?: string | null; coordinator_text?: string }) => void
}) {
  const contacts = useContacts()
  const list = [...(contacts.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'he'))
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="מתאם אמי — איש קשר מהמערכת">
        <select className="input" value={contactId ?? ''} onChange={(e) => onChange({ coordinator_contact_id: e.target.value || null })}>
          <option value="">—</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.role ? ` · ${c.role}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="או כתוב בחופשיות">
        <input className="input" dir="auto" value={text} onChange={(e) => onChange({ coordinator_text: e.target.value })} placeholder="למשל: דנה ממחלקת לוגיסטיקה" />
      </Field>
    </div>
  )
}
