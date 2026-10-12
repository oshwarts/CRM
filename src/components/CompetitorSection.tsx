import { useState } from 'react'
import { Pencil, Plus, Swords } from 'lucide-react'
import {
  useCompanies,
  useCompetitorIntel,
  useDeleteIntel,
  useDoctors,
  useHospitals,
  useSaveIntel,
  type IntelFormData,
} from '../lib/api'
import type { CompetitorIntelRow } from '../lib/types'
import { todayISO, formatDate } from '../lib/utils'
import { ConfirmButton, Field, Modal } from './ui'

export function IntelFormModal({
  intel,
  defaults,
  onClose,
}: {
  intel?: CompetitorIntelRow | null
  defaults?: Partial<IntelFormData>
  onClose: () => void
}) {
  const companies = useCompanies()
  const intelAll = useCompetitorIntel()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const save = useSaveIntel()
  const del = useDeleteIntel()
  const [error, setError] = useState('')
  const [d, setD] = useState<IntelFormData>(() =>
    intel
      ? {
          id: intel.id,
          competitor: intel.competitor,
          product: intel.product,
          offer: intel.offer,
          notes: intel.notes,
          intel_date: intel.intel_date,
          doctor_id: intel.doctor_id,
          hospital_id: intel.hospital_id,
        }
      : { competitor: '', product: '', offer: '', notes: '', intel_date: todayISO(), doctor_id: null, hospital_id: null, ...defaults },
  )
  const set = (p: Partial<IntelFormData>) => setD((x) => ({ ...x, ...p }))

  // names already used + companies of the system, as suggestions
  const names = [...new Set([...(companies.data ?? []).map((c) => c.name), ...(intelAll.data ?? []).map((i) => i.competitor)].filter(Boolean))]

  async function submit() {
    setError('')
    if (!d.competitor.trim()) return setError('כתוב מי המתחרה')
    try {
      await save.mutateAsync(d)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={intel ? 'עריכת פעילות מתחרה' : 'פעילות מתחרה חדשה'} size="md">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="מתחרה / חברה">
            <input className="input" list="competitor-names" value={d.competitor} onChange={(e) => set({ competitor: e.target.value })} autoFocus />
            <datalist id="competitor-names">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="מוצר / רובוט / שתל">
            <input className="input" value={d.product} onChange={(e) => set({ product: e.target.value })} placeholder="למשל: ROSA, VELYS, Persona" />
          </Field>
        </div>
        <Field label="מה מציעים / תנאים">
          <textarea className="input min-h-16" dir="auto" value={d.offer} onChange={(e) => set({ offer: e.target.value })} placeholder="הנחות, תנאי מימון, הדרכה, השאלת ציוד…" />
        </Field>
        <Field label="הערות">
          <textarea className="input min-h-16" dir="auto" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="תאריך">
            <input type="date" className="input" value={d.intel_date} onChange={(e) => set({ intel_date: e.target.value })} />
          </Field>
          <Field label="רופא">
            <select className="input" value={d.doctor_id ?? ''} onChange={(e) => set({ doctor_id: e.target.value || null })}>
              <option value="">—</option>
              {(doctors.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="בית חולים">
            <select className="input" value={d.hospital_id ?? ''} onChange={(e) => set({ hospital_id: e.target.value || null })}>
              <option value="">—</option>
              {(hospitals.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <div>
            {intel && (
              <ConfirmButton message="למחוק את הרישום?" onConfirm={() => del.mutate(intel.id, { onSuccess: onClose })}>
                מחיקה
              </ConfirmButton>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button className="btn-primary" onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** competitor activity linked to one doctor or one hospital */
export function CompetitorSection({ doctorId, hospitalId }: { doctorId?: string; hospitalId?: string }) {
  const intel = useCompetitorIntel()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CompetitorIntelRow | null>(null)
  const list = (intel.data ?? []).filter((i) => (doctorId ? i.doctor_id === doctorId : hospitalId ? i.hospital_id === hospitalId : false))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
          <Swords size={12} /> פעילות מתחרים ({list.length})
        </p>
        <button className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setAdding(true)}>
          <Plus size={14} className="inline" /> הוסף
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-slate-400">לא תועדה פעילות של מתחרים</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {list.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-800">
                  {i.competitor}
                  {i.product && <span className="font-normal text-slate-500"> · {i.product}</span>}
                  <span className="mr-2 text-xs font-normal text-slate-400">{formatDate(i.intel_date)}</span>
                </p>
                {i.offer && <p dir="auto" className="whitespace-pre-line text-slate-600">{i.offer}</p>}
                {i.notes && <p dir="auto" className="whitespace-pre-line text-xs text-slate-400">{i.notes}</p>}
              </div>
              <button className="btn-ghost !px-2" onClick={() => setEditing(i)} aria-label="עריכה">
                <Pencil size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && <IntelFormModal onClose={() => setAdding(false)} defaults={{ doctor_id: doctorId ?? null, hospital_id: hospitalId ?? null }} />}
      {editing && <IntelFormModal intel={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
