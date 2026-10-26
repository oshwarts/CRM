import { useContacts, useHospitals, useSetHospitalScanContact } from '../lib/api'
import { Field } from './ui'

/** Who coordinates the CT appointments at a hospital: one contact per hospital, saved on the hospital itself */
export function ScanContactField({ hospitalId }: { hospitalId: string }) {
  const hospitals = useHospitals()
  const contacts = useContacts()
  const save = useSetHospitalScanContact()
  if (!hospitalId) return null

  const current = hospitals.data?.find((h) => h.id === hospitalId)?.scan_contact_id ?? ''
  const all = contacts.data ?? []
  // the hospital's own contacts first, then everyone else
  const list = [...all].sort((a, b) => Number(b.hospital_id === hospitalId) - Number(a.hospital_id === hospitalId) || a.name.localeCompare(b.name, 'he'))
  const picked = all.find((c) => c.id === current)

  return (
    <Field label="איש קשר לתיאום תורים (בבית החולים)" className="col-span-2 sm:col-span-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input min-w-0 flex-1"
          value={current}
          disabled={save.isPending}
          onChange={(e) => save.mutate({ hospitalId, contactId: e.target.value || null })}
        >
          <option value="">—</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.role ? ` · ${c.role}` : ''}
              {c.hospital_id === hospitalId ? '' : c.hospital_id ? ' (בית חולים אחר)' : ''}
            </option>
          ))}
        </select>
        {picked?.phone && (
          <a className="text-sm text-brand-700 underline" dir="ltr" href={`tel:${picked.phone}`}>
            {picked.phone}
          </a>
        )}
      </div>
      {save.isError && <p className="mt-1 text-xs text-red-600">השמירה נכשלה</p>}
      <p className="mt-1 text-xs text-slate-500">נשמר על בית החולים, ולכן מופיע לכל הסריקות שלו.</p>
    </Field>
  )
}

/** the coordinator of the CT appointments at a hospital, as a short line for the scan lists */
export function ScanContactLine({ hospitalId, className }: { hospitalId: string | undefined; className?: string }) {
  const hospitals = useHospitals()
  const contacts = useContacts()
  const id = hospitals.data?.find((h) => h.id === hospitalId)?.scan_contact_id
  const c = id ? contacts.data?.find((x) => x.id === id) : undefined
  if (!c) return null
  return (
    <div className={className} title="איש קשר לתיאום תורים">
      תיאום: {c.name}
      {c.phone && (
        <>
          {' · '}
          <a href={`tel:${c.phone}`} dir="ltr" className="underline" onClick={(e) => e.stopPropagation()}>
            {c.phone}
          </a>
        </>
      )}
    </div>
  )
}
