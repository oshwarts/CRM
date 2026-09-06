import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useAllCaseVolumes,
  useCompanies,
  useDeleteCaseVolume,
  useDoctors,
  useHospitals,
  useProcedures,
  useUpsertCaseVolume,
} from '../lib/api'
import { CURRENT_YEAR, YEAR_OPTIONS } from '../lib/types'
import { ConfirmButton, EmptyState, Spinner } from './ui'

const emptyDraft = {
  doctor_id: '',
  hospital_id: '',
  procedure_id: '',
  company_id: '',
  year: CURRENT_YEAR,
  count: 0,
}

export function CaseVolumesManager() {
  const volumes = useAllCaseVolumes()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const procedures = useProcedures()
  const companies = useCompanies()
  const upsert = useUpsertCaseVolume()
  const del = useDeleteCaseVolume()

  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  // hospitals limited to the ones the chosen doctor works at (if chosen)
  const hospitalOptions = useMemo(() => {
    const all = hospitals.data ?? []
    if (!draft.doctor_id) return all
    const doc = (doctors.data ?? []).find((d) => d.id === draft.doctor_id)
    const ids = new Set(doc?.doctor_hospitals.map((h) => h.hospital_id) ?? [])
    const linked = all.filter((h) => ids.has(h.id))
    return linked.length ? linked : all
  }, [hospitals.data, doctors.data, draft.doctor_id])

  async function add() {
    setError(null)
    if (!draft.doctor_id || !draft.hospital_id || !draft.procedure_id) {
      setError('יש לבחור רופא, בית חולים והליך')
      return
    }
    try {
      await upsert.mutateAsync({
        doctor_id: draft.doctor_id,
        hospital_id: draft.hospital_id,
        procedure_id: draft.procedure_id,
        company_id: draft.company_id || null,
        year: draft.year,
        count: draft.count,
      })
      setDraft({ ...draft, procedure_id: '', company_id: '', count: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    }
  }

  const rows = volumes.data ?? []

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-slate-800">הוספה ועריכה של כמויות מקרים</h2>
        <p className="text-sm text-slate-400">
          כל רשומה משויכת לרופא ולבית חולים, כך שהסכומים בדוח מתאזנים אוטומטית.
        </p>
      </div>

      {/* add row */}
      <div className="grid gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3 lg:grid-cols-[1.3fr_1.3fr_1.3fr_1fr_.7fr_.7fr_auto]">
        <select
          className="input"
          value={draft.doctor_id}
          onChange={(e) =>
            setDraft({ ...draft, doctor_id: e.target.value, hospital_id: '' })
          }
        >
          <option value="">רופא…</option>
          {(doctors.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} {d.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={draft.hospital_id}
          onChange={(e) => setDraft({ ...draft, hospital_id: e.target.value })}
        >
          <option value="">בית חולים…</option>
          {hospitalOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={draft.procedure_id}
          onChange={(e) => setDraft({ ...draft, procedure_id: e.target.value })}
        >
          <option value="">הליך…</option>
          {(procedures.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={draft.company_id}
          onChange={(e) => setDraft({ ...draft, company_id: e.target.value })}
        >
          <option value="">חברה (אופ׳)</option>
          {(companies.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={draft.year}
          onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          className="input text-center"
          placeholder="כמות"
          value={draft.count || ''}
          onChange={(e) =>
            setDraft({
              ...draft,
              count: Math.max(0, Number(e.target.value) || 0),
            })
          }
        />
        <button className="btn-primary" onClick={add} disabled={upsert.isPending}>
          <Plus size={16} />
          הוסף
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {volumes.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="עדיין לא הוזנו כמויות" hint="הוסף רשומה ראשונה למעלה" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="p-2 text-right font-medium">רופא</th>
                <th className="p-2 text-right font-medium">בית חולים</th>
                <th className="p-2 text-right font-medium">הליך</th>
                <th className="p-2 text-right font-medium">חברה</th>
                <th className="p-2 text-center font-medium">שנה</th>
                <th className="p-2 text-center font-medium">כמות</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="p-2 text-slate-700">
                    {r.doctor?.title} {r.doctor?.name}
                  </td>
                  <td className="p-2 text-slate-600">{r.hospital?.name}</td>
                  <td className="p-2 text-slate-600">{r.procedure?.name}</td>
                  <td className="p-2 text-slate-400">{r.company?.name ?? '—'}</td>
                  <td className="p-2 text-center text-slate-500">{r.year}</td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      min={0}
                      className="input w-20 py-1 text-center"
                      defaultValue={r.count}
                      onBlur={(e) => {
                        const count = Math.max(0, Number(e.target.value) || 0)
                        if (count !== r.count)
                          upsert.mutate({
                            id: r.id,
                            doctor_id: r.doctor_id,
                            hospital_id: r.hospital_id,
                            procedure_id: r.procedure_id,
                            company_id: r.company_id,
                            year: r.year,
                            count,
                          })
                      }}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <ConfirmButton
                      className="btn-ghost !px-2 text-red-500"
                      onConfirm={() => del.mutate(r.id)}
                    >
                      <Trash2 size={14} />
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
