import { useMemo, useRef, useState } from 'react'
import { Plus, ScanLine, Trash2, X } from 'lucide-react'
import {
  useCaseVolumes,
  useCompanies,
  useDeleteCaseVolume,
  useDoneScanCounts,
  useProcedures,
  useUpsertCaseVolume,
} from '../lib/api'
import { CURRENT_YEAR, YEAR_OPTIONS } from '../lib/types'
import { ConfirmButton, EmptyState, ErrorState, Field, Spinner } from './ui'

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
  const doneScans = useDoneScanCounts()
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
  const [adding, setAdding] = useState(false)
  const busy = useRef(false)

  const rows = useMemo(() => volumes.data ?? [], [volumes.data])
  // the only doctor / hospital to choose from is chosen
  const entityId = draft.entityId || (entityOptions.length === 1 ? entityOptions[0].id : '')

  const procByName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of procedures.data ?? []) m[p.name] = p.id
    return m
  }, [procedures.data])

  const scanCounts = useMemo(
    () =>
      (doneScans.data ?? [])
        .filter((s) =>
          isDoctorMode ? s.surgeon_id === props.doctorId : s.hospital_id === props.hospitalId,
        )
        .map((s) => ({
          ...s,
          otherId: isDoctorMode ? s.hospital_id : s.surgeon_id,
          otherLabel:
            entityOptions.find(
              (o) => o.id === (isDoctorMode ? s.hospital_id : s.surgeon_id),
            )?.label ?? '—',
          procedure_id: procByName[s.procedure_name],
        }))
        .sort((a, b) => b.year - a.year),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doneScans.data, procByName, entityOptions, isDoctorMode],
  )

  async function applyScanCount(s: (typeof scanCounts)[number]) {
    if (!s.procedure_id || !s.otherId) return
    const doctor_id = isDoctorMode ? props.doctorId! : s.otherId
    const hospital_id = isDoctorMode ? s.otherId : props.hospitalId!
    const existing = rows.find(
      (r) =>
        r.doctor_id === doctor_id &&
        r.hospital_id === hospital_id &&
        r.procedure_id === s.procedure_id &&
        !r.company_id &&
        r.year === s.year,
    )
    await upsert.mutateAsync({
      id: existing?.id,
      doctor_id,
      hospital_id,
      procedure_id: s.procedure_id,
      company_id: null,
      year: s.year,
      count: s.count,
    })
  }

  const totalsByYear = useMemo(() => {
    const m: Record<number, number> = {}
    for (const r of rows) m[r.year] = (m[r.year] ?? 0) + r.count
    return m
  }, [rows])

  async function add() {
    setError(null)
    if (busy.current) return
    if (!entityId || !draft.procedure_id) {
      setError(`יש לבחור ${entityLabel} והליך`)
      return
    }
    if (draft.count < 1) {
      setError('הזן כמות מקרים (1 ומעלה)')
      return
    }
    const doctor_id = isDoctorMode ? props.doctorId! : entityId
    const hospital_id = isDoctorMode ? entityId : props.hospitalId!
    const company_id = draft.company_id || null
    if (rows.some((r) => r.doctor_id === doctor_id && r.hospital_id === hospital_id && r.procedure_id === draft.procedure_id && r.company_id === company_id && r.year === draft.year)) {
      setError('כבר קיימת רשומה עם אותו רופא / בי״ח / הליך / חברה / שנה — עדכן את הכמות בטבלה')
      return
    }
    busy.current = true
    try {
      await upsert.mutateAsync({
        doctor_id,
        hospital_id,
        procedure_id: draft.procedure_id,
        company_id,
        year: draft.year,
        count: draft.count,
      })
      setDraft({ ...draft, procedure_id: '', company_id: '', count: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    } finally {
      busy.current = false
    }
  }

  if (volumes.isLoading) return <Spinner />
  if (volumes.error && !volumes.data) return <ErrorState error={volumes.error} />

  type Row = (typeof rows)[number]
  const saveCount = (r: Row, input: HTMLInputElement) => {
    const count = Math.max(0, Math.floor(Number(input.value) || 0))
    input.value = String(count)
    if (count !== r.count)
      upsert.mutate(
        {
        id: r.id,
        doctor_id: r.doctor_id,
        hospital_id: r.hospital_id,
        procedure_id: r.procedure_id,
        company_id: r.company_id,
        year: r.year,
        count,
        },
        // a refused save puts the old number back
        { onError: () => (input.value = String(r.count)) },
      )
  }
  const nameOf = (r: Row) => (isDoctorMode ? r.hospital?.name : [r.doctor?.title, r.doctor?.name].filter(Boolean).join(' ')) || '—'
  const countLabel = (r: Row) => `כמות: ${nameOf(r)} ${r.procedure?.name ?? ''} ${r.year}`
  const deleteLabel = (r: Row) => `מחיקת כמות: ${nameOf(r)} ${r.procedure?.name ?? ''} ${r.year}`
  const deleteMessage = (r: Row) => `למחוק את הכמות (${nameOf(r)} · ${r.procedure?.name ?? '—'}${r.company?.name ? ` · ${r.company.name}` : ''} · ${r.year}: ${r.count} מקרים)? הפעולה אינה הפיכה.`
  const showForm = adding || rows.length === 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-48 text-sm text-slate-500">
          כמות מקרים שנתית לפי {entityLabel} והליך. הסכומים מתאזנים אוטומטית בין הרופא לבית החולים.
        </p>
        {!showForm && (
          <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            הוספת כמות
          </button>
        )}
      </div>

      {Object.keys(totalsByYear).length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="סה״כ מקרים לפי שנה">
          {Object.entries(totalsByYear)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([year, total]) => (
              <li key={year} className="chip border-brand-200 bg-brand-50 text-brand-700">
                {year}: <b>{total}</b> מקרים
              </li>
            ))}
        </ul>
      )}

      {showForm && (
        <div className="card space-y-3 border-brand-200 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.4fr_1.4fr_1fr_.7fr_.7fr]">
            <Field label={entityLabel} className="col-span-2 sm:col-span-1">
              <select className="input" value={entityId} onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}>
                <option value="">בחר…</option>
                {entityOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="הליך" className="col-span-2 sm:col-span-1">
              <select className="input" value={draft.procedure_id} onChange={(e) => setDraft({ ...draft, procedure_id: e.target.value })}>
                <option value="">בחר…</option>
                {(procedures.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="חברה (אופציונלי)" className="col-span-2 sm:col-span-1">
              <select className="input" value={draft.company_id} onChange={(e) => setDraft({ ...draft, company_id: e.target.value })}>
                <option value="">ללא</option>
                {(companies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="שנה">
              <select className="input" value={draft.year} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })}>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="כמות">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="input text-center"
                value={draft.count || ''}
                onChange={(e) => setDraft({ ...draft, count: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
            </Field>
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {rows.length > 0 && (
              <button
                type="button"
                className="btn-secondary flex-1 sm:flex-none"
                onClick={() => {
                  setAdding(false)
                  setError(null)
                }}
              >
                <X size={16} />
                סגירה
              </button>
            )}
            <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={add} disabled={upsert.isPending}>
              <Plus size={16} />
              הוספה
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="לא הוזנו כמויות" />
      ) : (
        <>
          {/* phone: one card per row */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="card flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="break-words font-medium text-slate-800">{nameOf(r)}</p>
                  <p className="break-words text-slate-600">{r.procedure?.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.year}
                    {r.company?.name ? ` · ${r.company.name}` : ''}
                  </p>
                </div>
                <input
                  key={`${r.id}-${r.count}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  aria-label={countLabel(r)}
                  className="input !w-20 shrink-0 text-center"
                  defaultValue={r.count}
                  onBlur={(e) => saveCount(r, e.currentTarget)}
                />
                <ConfirmButton className="btn-ghost shrink-0 !px-2.5 text-red-600" label={deleteLabel(r)} message={deleteMessage(r)} onConfirm={() => del.mutate(r.id)}>
                  <Trash2 size={16} />
                </ConfirmButton>
              </li>
            ))}
          </ul>
          {/* wide screens: a table */}
          <div tabIndex={0} role="region" aria-label="כמויות מקרים" className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="p-2 text-right font-medium">{entityLabel}</th>
                  <th className="p-2 text-right font-medium">הליך</th>
                  <th className="p-2 text-right font-medium">חברה</th>
                  <th className="p-2 text-center font-medium">שנה</th>
                  <th className="p-2 text-center font-medium">כמות</th>
                  <th className="p-2">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-2 text-slate-700">{nameOf(r)}</td>
                    <td className="p-2 text-slate-600">{r.procedure?.name}</td>
                    <td className="p-2 text-slate-500">{r.company?.name ?? '—'}</td>
                    <td className="p-2 text-center text-slate-500">{r.year}</td>
                    <td className="p-2 text-center">
                      <input
                        key={`${r.id}-${r.count}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        aria-label={countLabel(r)}
                        className="input !w-20 py-1 text-center"
                        defaultValue={r.count}
                        onBlur={(e) => saveCount(r, e.currentTarget)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <ConfirmButton className="btn-ghost !px-2 text-red-600" label={deleteLabel(r)} message={deleteMessage(r)} onConfirm={() => del.mutate(r.id)}>
                        <Trash2 size={14} />
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {scanCounts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <ScanLine size={15} className="text-brand-500" />
            ניתוחי MAKO שבוצעו (מתוך עמוד הסריקות)
          </p>
          <ul className="divide-y divide-slate-200">
            {scanCounts.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="break-words text-slate-700">{s.otherLabel}</p>
                  <p className="break-words text-xs text-slate-500">
                    {s.procedure_name} · {s.year}
                  </p>
                </div>
                <span className="text-lg font-semibold text-slate-800" aria-label={`${s.count} ניתוחים`}>
                  {s.count}
                </span>
                <button type="button" className="btn-secondary" disabled={!s.procedure_id || upsert.isPending} onClick={() => applyScanCount(s)}>
                  עדכן כמות
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">"עדכן כמות" מעדכן את הכמות הידנית שלמעלה לפי מספר הניתוחים שבוצעו.</p>
        </div>
      )}
    </div>
  )
}
