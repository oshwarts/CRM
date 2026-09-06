import { useState } from 'react'
import { Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import {
  useContacts,
  useDeleteContact,
  useUpsertContact,
} from '../lib/api'
import { CONTACT_ROLES, type Contact } from '../lib/types'
import { ConfirmButton, EmptyState, Field } from './ui'

type Draft = {
  id?: string
  name: string
  role: string
  phone: string
  email: string
  notes: string
}

const empty: Draft = { name: '', role: '', phone: '', email: '', notes: '' }

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

  const list = (contacts.data ?? []).filter((c) =>
    hospitalId ? c.hospital_id === hospitalId : c.doctor_id === doctorId,
  )

  async function save() {
    if (!draft || !draft.name.trim()) return
    await upsert.mutateAsync({
      ...draft,
      name: draft.name.trim(),
      hospital_id: hospitalId ?? null,
      doctor_id: doctorId ?? null,
    })
    setDraft(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          אנשי קשר נוספים (אחות אחראית, טכנאי, רכש…)
        </p>
        {!draft && (
          <button className="btn-secondary" onClick={() => setDraft({ ...empty })}>
            <Plus size={16} />
            איש קשר
          </button>
        )}
      </div>

      {list.length === 0 && !draft && <EmptyState title="אין אנשי קשר" />}

      {list.map((c) =>
        draft?.id === c.id ? (
          <ContactForm
            key={c.id}
            draft={draft}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={save}
          />
        ) : (
          <ContactCard
            key={c.id}
            contact={c}
            onEdit={() =>
              setDraft({
                id: c.id,
                name: c.name,
                role: c.role,
                phone: c.phone,
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
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={save}
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
    <div className="card flex items-start justify-between gap-3 p-4">
      <div className="text-sm">
        <p className="font-medium text-slate-800">
          {c.name}
          {c.role && (
            <span className="mr-2 text-xs font-normal text-slate-400">
              {c.role}
            </span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
          {c.phone && (
            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1" dir="ltr">
              <Phone size={13} /> {c.phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1" dir="ltr">
              <Mail size={13} /> {c.email}
            </a>
          )}
        </div>
        {c.notes && <p className="mt-1 text-xs text-slate-400">{c.notes}</p>}
      </div>
      <div className="flex gap-1">
        <button className="btn-ghost !px-2" onClick={onEdit}>
          <Pencil size={14} />
        </button>
        <ConfirmButton
          className="btn-ghost !px-2 text-red-500"
          onConfirm={onDelete}
        >
          <Trash2 size={14} />
        </ConfirmButton>
      </div>
    </div>
  )
}

function ContactForm({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="card space-y-3 border-brand-200 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שם">
          <input
            className="input"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="תפקיד">
          <input
            className="input"
            list="contact-roles"
            value={draft.role}
            onChange={(e) => onChange({ ...draft, role: e.target.value })}
          />
          <datalist id="contact-roles">
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="טלפון">
          <input
            dir="ltr"
            className="input text-right"
            value={draft.phone}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
          />
        </Field>
        <Field label="אימייל">
          <input
            dir="ltr"
            className="input text-right"
            value={draft.email}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
          />
        </Field>
        <Field label="הערות" className="sm:col-span-2">
          <input
            className="input"
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>
          ביטול
        </button>
        <button className="btn-primary" onClick={onSave} disabled={!draft.name.trim()}>
          שמירה
        </button>
      </div>
    </div>
  )
}
