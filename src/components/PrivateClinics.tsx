import { useState } from 'react'
import { MapPin, Navigation, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatDays, useDeletePrivateClinic, useDoctorPrivateClinics, useSavePrivateClinic, type PrivateClinic } from '../lib/clinics'
import { toast } from '../lib/toast'
import { DayPicker } from './DayPicker'
import { ConfirmButton, Field } from './ui'

/** the private clinics of a doctor: where (an address, not a hospital) and on which days */
export function PrivateClinics({ doctorId }: { doctorId: string }) {
  const clinics = useDoctorPrivateClinics(doctorId)
  const save = useSavePrivateClinic(doctorId)
  const del = useDeletePrivateClinic(doctorId)
  const [editing, setEditing] = useState<PrivateClinic | 'new' | null>(null)
  const [address, setAddress] = useState('')
  const [days, setDays] = useState<number[]>([])

  function open(c: PrivateClinic | 'new') {
    setEditing(c)
    setAddress(c === 'new' ? '' : c.address)
    setDays(c === 'new' ? [] : c.clinic_days)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, address, clinic_days: days },
      { onSuccess: () => setEditing(null), onError: () => toast('השמירה נכשלה', { kind: 'error' }) },
    )
  }

  const list = clinics.data ?? []
  return (
    <section className="card space-y-3 p-4" aria-label="מרפאות פרטיות">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">מרפאות פרטיות</h2>
        {editing === null && (
          <button type="button" className="btn-secondary" onClick={() => open('new')}>
            <Plus size={16} aria-hidden />
            הוסף מרפאה
          </button>
        )}
      </div>
      {list.length === 0 && editing === null && <p className="text-sm text-slate-500">לא נוספו מרפאות פרטיות. אפשר להוסיף כתובת וימי קבלה.</p>}
      <ul className="space-y-2">
        {list.map((c) =>
          editing !== 'new' && editing?.id === c.id ? null : (
            <li key={c.id} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p dir="auto" className="text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">
                  {c.address || '—'}
                </p>
                <p className="text-xs text-slate-500">{c.clinic_days.length ? `ימי קבלה: ${formatDays(c.clinic_days)}` : 'ימי הקבלה לא הוגדרו'}</p>
              </div>
              <a
                className="btn-ghost !px-2"
                href={`https://waze.com/ul?q=${encodeURIComponent(c.address)}&navigate=yes`}
                target="_blank"
                rel="noreferrer"
                aria-label={`ניווט ב-Waze אל ${c.address}`}
                title="ניווט"
              >
                <Navigation size={16} />
              </a>
              <button type="button" className="btn-ghost !px-2" aria-label="עריכת המרפאה" onClick={() => open(c)}>
                <Pencil size={16} />
              </button>
              <ConfirmButton className="btn-ghost !px-2 text-red-600" label="מחיקת המרפאה" message="למחוק את המרפאה?" onConfirm={() => del.mutate(c.id)}>
                <Trash2 size={16} />
              </ConfirmButton>
            </li>
          ),
        )}
      </ul>
      {editing !== null && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-50 p-3">
          <Field label="כתובת המרפאה">
            <input className="input" dir="auto" autoComplete="street-address" enterKeyHint="done" placeholder="רחוב, מספר, עיר" value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div>
            <p className="label">ימי קבלה</p>
            <DayPicker value={days} onChange={setDays} label="ימי קבלה במרפאה" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              ביטול
            </button>
            <button type="submit" className="btn-primary max-sm:flex-1" disabled={!address.trim() || save.isPending}>
              שמירה
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
