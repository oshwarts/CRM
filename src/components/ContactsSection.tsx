import { useRef, useState } from 'react'
import { Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import {
  useContacts,
  useDeleteContact,
  useUpsertContact,
} from '../lib/api'
import { CONTACT_ROLES, type Contact } from '../lib/types'
import { ConfirmButton, EmptyState, ErrorState, Field, Spinner } from './ui'
import { ImportContactButton } from './ImportContactButton'
import { StickyActions } from './StickyActions'
import { mailHref, telHref } from '../lib/hospitalView'

type Draft = {
  id?: string
  name: string
  role: string
  phone: string
  office_phone: string
  email: string
  notes: string
}

const empty: Draft = { name: '', role: '', phone: '', office_phone: '', email: '', notes: '' }
// a contact added on a doctor's card is usually his secretary
const emptyFor = (doctorId?: string): Draft => ({ ...empty, role: doctorId ? 'מזכירת רופא' : '' })

export function ContactsSection({
  hospitalId,
  doctorId,
}: {
  hospitalId?: string
  doctorId?: string
}) {
  const contacts = useContacts()
  const upsert = useUpsertContact()
  const del = useDeleteContact()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [nameError, setNameError] = useState('')
  const busy = useRef(false) // a second tap in the same instant must not send a second copy

  const list = (contacts.data ?? []).filter((c) =>
    hospitalId ? c.hospital_id === hospitalId : c.doctor_id === doctorId,
  )

  const change = (d: Draft | null) => {
    setDraft(d)
    setNameError('')
  }

  async function save() {
    if (!draft || busy.current) return
    const name = draft.name.trim()
    if (!name) return setNameError('הזן שם לאיש הקשר')
    busy.current = true
    try {
      await upsert.mutateAsync({
        ...draft,
        name,
        role: draft.role.trim(),
        phone: draft.phone.trim(),
        office_phone: draft.office_phone.trim(),
        email: draft.email.trim(),
        notes: draft.notes.trim(),
        hospital_id: hospitalId ?? null,
        doctor_id: doctorId ?? null,
      })
      change(null)
    } catch {
      // the message of the failure is shown by the app; the form stays open with what was typed
    } finally {
      busy.current = false
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-48 text-sm text-slate-500">
          {hospitalId
            ? 'עובדי בית החולים: מזכירת רופא, אחות ראשית, אחים בחדרי ניתוח, מכון דימות, רכש…'
            : 'אנשי קשר של הרופא — בדרך כלל המזכירה שלו'}
        </p>
        {!draft && (
          <button type="button" className="btn-secondary" onClick={() => change(emptyFor(doctorId))}>
            <Plus size={16} />
            איש קשר
          </button>
        )}
      </div>

      {contacts.isLoading && <Spinner />}
      {contacts.error && !contacts.data && <ErrorState error={contacts.error} />}
      {list.length === 0 && !draft && !contacts.isLoading && !contacts.error && (
        <EmptyState title="אין אנשי קשר" hint="הוסף איש קשר בכפתור 'איש קשר' למעלה" />
      )}

      {list.map((c) =>
        draft?.id === c.id ? (
          <ContactForm
            key={c.id}
            draft={draft}
            onChange={change}
            onCancel={() => change(null)}
            onSave={save}
            saving={upsert.isPending}
            nameError={nameError}
          />
        ) : (
          <ContactCard
            key={c.id}
            contact={c}
            onEdit={() =>
              change({
                id: c.id,
                name: c.name,
                role: c.role,
                phone: c.phone,
                office_phone: c.office_phone,
                email: c.email,
                notes: c.notes,
              })
            }
            onDelete={() => del.mutate(c.id)}
          />
        ),
      )}

      {draft && !draft.id && (
        <ContactForm
          draft={draft}
          onChange={change}
          onCancel={() => change(null)}
          onSave={save}
          saving={upsert.isPending}
          nameError={nameError}
        />
      )}
    </div>
  )
}

function ContactCard({
  contact: c,
  onEdit,
  onDelete,
}: {
  contact: Contact
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="card space-y-2 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p dir="auto" className="break-words font-medium text-slate-800">{c.name}</p>
          {c.role && <p dir="auto" className="break-words text-xs text-slate-500">{c.role}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="btn-ghost !px-2.5" aria-label={`עריכת ${c.name}`} onClick={onEdit}>
            <Pencil size={16} />
          </button>
          <ConfirmButton className="btn-ghost !px-2.5 text-red-600" label={`מחיקת ${c.name}`} message={`למחוק את איש הקשר "${c.name}"? הפעולה אינה הפיכה.`} onConfirm={onDelete}>
            <Trash2 size={16} />
          </ConfirmButton>
        </div>
      </div>
      {(c.phone || c.office_phone || c.email) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {c.phone && (
            <a href={telHref(c.phone)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-brand-50 px-3 text-brand-700" dir="ltr">
              <Phone size={14} /> {c.phone}
            </a>
          )}
          {c.office_phone && (
            <a href={telHref(c.office_phone)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-brand-50 px-3 text-brand-700" dir="ltr" title="טלפון במשרד">
              <Phone size={14} /> {c.office_phone} <span className="text-xs text-slate-500">(משרד)</span>
            </a>
          )}
          {c.email && (
            <a href={mailHref(c.email)} className="inline-flex min-h-[40px] max-w-full items-center gap-1.5 rounded-full bg-brand-50 px-3 text-brand-700" dir="ltr">
              <Mail size={14} className="shrink-0" /> <span className="min-w-0 break-all">{c.email}</span>
            </a>
          )}
        </div>
      )}
      {c.notes && <p dir="auto" className="break-words text-sm text-slate-500">{c.notes}</p>}
    </div>
  )
}

function ContactForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  nameError,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  nameError: string
}) {
  return (
    <form
      noValidate
      className="card space-y-3 border-brand-200 p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שם" error={nameError}>
          <input
            className="input"
            dir="auto"
            autoComplete="off"
            autoFocus
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="תפקיד">
          <input
            className="input"
            dir="auto"
            list="contact-roles" placeholder="בחר מהרשימה או כתוב תפקיד חופשי"
            value={draft.role}
            onChange={(e) => onChange({ ...draft, role: e.target.value })}
          />
          <datalist id="contact-roles">
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <div className="sm:col-span-2">
          <ImportContactButton
            onPick={(c) =>
              onChange({
                ...draft,
                name: draft.name || c.name,
                phone: c.phone || draft.phone,
                email: c.email || draft.email,
              })
            }
          />
        </div>
        <Field label="טלפון">
          <input
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className="input text-right"
            value={draft.phone}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
          />
        </Field>
        <Field label="טלפון נוסף במשרד">
          <input
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className="input text-right"
            value={draft.office_phone}
            onChange={(e) => onChange({ ...draft, office_phone: e.target.value })}
          />
        </Field>
        <Field label="אימייל">
          <input
            dir="ltr"
            type="email"
            inputMode="email"
            autoComplete="off"
            className="input text-right"
            value={draft.email}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
          />
        </Field>
        <Field label="הערות" className="sm:col-span-2">
          <input
            className="input"
            dir="auto"
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </Field>
      </div>
      <StickyActions>
        <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={onCancel}>
          ביטול
        </button>
        <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={saving}>
          שמירה
        </button>
      </StickyActions>
    </form>
  )
}
