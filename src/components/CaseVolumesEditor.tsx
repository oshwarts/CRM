import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useCaseVolumes,
  useCompanies,
  useDeleteCaseVolume,
  useProcedures,
  useUpsertCaseVolume,
} from '../lib/api'
import { CURRENT_YEAR, YEAR_OPTIONS } from '../lib/types'
import { ConfirmButton, EmptyState, Spinner } from './ui'

type Option = { id: string; label: string }

type Props =
  | { doctorId: string; hospitalId?: undefined; entityOptions: Option[] }
  | { hospitalId: string; doctorId?: undefined; entityOptions: Option[] }

export function CaseVolumesEditor(props: Props) {
  const { entityOptions } = props
  const isDoctorMode = 'doctorId' in props && !!props.doctorId
  const entityLabel = isDoctorMode ? 'בית חולים' : 'רופא'

  const volumes = useCaseVolumes({
    doctorId: props.doctorId,
    hospitalId: props.hospitalId,
  })
  const procedures = useProcedures()
  const companies = useCompanies()
  const upsert = useUpsertCaseVolume()
  const del = useDeleteCaseVolume()

  const [draft, setDraft] = useState({
    entityId: '',
    procedure_id: '',
    company_id: '',
    year: CURRENT_YEAR,
    count: 0,
  })
  const [error, setError] = useState<string | null>(null)

  const rows = volumes.data ?? []

  const totalsByYear = useMemo(() => {
    const m: Record<number, number> = {}
    for (const r of rows) m[r.year] = (m[r.year] ?? 0) + r.count
    return m
  }, [rows])

  async function add() {
    setError(null)
    if (!draft.entityId || !draft.procedure_id) {
      setError(`יש לבחור ${entityLabel} והליך`)
      return
    }
    try {
      await upsert.mutateAsync({
        doctor_id: isDoctorMode ? props.doctorId! : draft.entityId,
        hospital_id: isDoctorMode ? draft.entityId : props.hospitalId!,
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

  if (volumes.isLoading) return <Spinner />

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        כמות מקרים שנתית. כל מקרה משויך לרופא ולבית חולים, כך שהסכומים מתאזנים
        אוטומטית בין הרופא לבית החולים.
      </p>

      {/* new row */}
      <div className="grid gap-2 rounded-xl border border-brand-200 p-3 sm:grid-cols-[1.4fr_1.4fr_1fr_.8fr_.8fr_auto]">
        <select
          className="input"
          value={draft.entityId}
          onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}
        >
          <option value="">{entityLabel}…</option>
          {entityOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
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
            setDraft({ ...draft, count: Math.max(0, Number(e.target.value) || 0) })
          }
        />
        <button className="btn-primary !px-3" onClick={add} disabled={upsert.isPending}>
          <Plus size={16} />
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="לא הוזנו כמויות" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="p-2 text-right font-medium">{entityLabel}</th>
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
                    {isDoctorMode ? r.hospital?.name : `${r.doctor?.title} ${r.doctor?.name}`}
                  </td>
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
            <tfoot>
              {Object.entries(totalsByYear)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([year, total]) => (
                  <tr key={year} className="bg-slate-50 font-medium text-slate-700">
                    <td className="p-2" colSpan={3}>
                      סה״כ {year}
                    </td>
                    <td className="p-2 text-center">{year}</td>
                    <td className="p-2 text-center">{total}</td>
                    <td className="p-2" />
                  </tr>
                ))}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
