import { useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useDeletePatientScan,
  usePatchPatientScan,
  usePatientScans,
} from '../lib/api'
import { ScanFormModal } from '../components/ScanFormModal'
import { ConfirmButton, EmptyState, ErrorState, Spinner } from '../components/ui'
import {
  IMPLANT_FIELDS,
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { classNames, daysUntil, formatDate, formatTime, todayISO } from '../lib/utils'

function implantSummary(s: PatientScanRow): string {
  const fields = IMPLANT_FIELDS[s.procedure_type] ?? []
  const data = (s.implant_data as Record<string, string>) ?? {}
  return fields
    .map((f) => (data[f.key] ? `${f.label} ${data[f.key]}` : null))
    .filter(Boolean)
    .join(' · ')
}

export default function Scans() {
  const scans = usePatientScans()
  const del = useDeletePatientScan()
  const patch = usePatchPatientScan()

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<PatientScanRow | null>(null)
  const [q, setQ] = useState('')
  const [hospital, setHospital] = useState('')
  const [status, setStatus] = useState('')

  const today = todayISO()

  const hospitals = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of scans.data ?? []) if (s.hospital) m.set(s.hospital.id, s.hospital.name)
    return [...m.entries()]
  }, [scans.data])

  const rows = useMemo(() => {
    return (scans.data ?? []).filter((s) => {
      if (hospital && s.hospital_id !== hospital) return false
      if (status && s.status !== status) return false
      if (q) {
        const hay = `${s.patient_name} ${s.patient_id_number} ${s.patient_phone} ${s.surgeon?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [scans.data, hospital, status, q])

  const upcoming = (scans.data ?? []).filter(
    (s) => s.ct_date && s.ct_date >= today && (daysUntil(s.ct_date) ?? 99) <= 7 && !s.scanned,
  ).length
  const overdue = (scans.data ?? []).filter(
    (s) => s.ct_date && s.ct_date < today && !s.scanned && s.status !== 'cancelled',
  ).length

  function exportCsv() {
    const head = [
      'תאריך', 'בית חולים', 'שם מלא', 'תז', 'טלפון', 'תאריך לידה', 'קופה', 'ביטוח',
      'מנתח', 'סוג', 'רגל', 'תאריך CT', 'שעת CT', 'מרדים', 'נסרק', 'הועלה', 'מידות שתל', 'סטטוס', 'הערות',
    ]
    const body = rows.map((s) => [
      formatDate(s.entry_date), s.hospital?.name ?? '', s.patient_name, s.patient_id_number,
      s.patient_phone, formatDate(s.patient_dob), s.health_fund, s.insurance,
      s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : '',
      SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type, s.side,
      formatDate(s.ct_date), formatTime(s.ct_time), s.anaesthesia_note,
      s.scanned ? 'כן' : 'לא', s.uploaded ? 'כן' : 'לא',
      implantSummary(s), SCAN_STATUS_LABELS[s.status] ?? s.status, s.notes,
    ])
    const csv = [head, ...body]
      .map((r) => r.map((v) => {
        const t = String(v ?? '')
        return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
      }).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'סריקות-MAKO.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">סריקות MAKO</h1>
          <p className="text-sm text-slate-400">
            מעקב סריקות CT למטופלי MAKO — כל בתי החולים יחד
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={16} />
            ייצוא CSV
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            הוסף מטופל
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="chip border-slate-200 bg-slate-50 text-slate-600">
          סה״כ {scans.data?.length ?? 0}
        </span>
        {upcoming > 0 && (
          <span className="chip border-amber-200 bg-amber-50 text-amber-700">
            CT בשבוע הקרוב · {upcoming}
          </span>
        )}
        {overdue > 0 && (
          <span className="chip border-red-200 bg-red-50 text-red-600">
            CT עבר וטרם נסרק · {overdue}
          </span>
        )}
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <input className="input" placeholder="חיפוש שם / ת״ז / טלפון / מנתח" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={hospital} onChange={(e) => setHospital(e.target.value)}>
          <option value="">כל בתי החולים</option>
          {hospitals.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.entries(SCAN_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {scans.isLoading && <Spinner />}
      {scans.error && <ErrorState error={scans.error} />}
      {scans.data && rows.length === 0 && (
        <EmptyState title="אין סריקות" hint="הוסף מטופל, או שנה את הסינון" />
      )}

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-slate-500">
                {['תאריך', 'בית חולים', 'שם מלא', 'ת״ז', 'טלפון', 'קופה', 'מנתח', 'סוג', 'רגל', 'CT', 'מרדים', 'נסרק', 'הועלה', 'מידות שתל', 'סטטוס', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap p-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const overdueRow = s.ct_date && s.ct_date < today && !s.scanned && s.status !== 'cancelled'
                const soon = s.ct_date && s.ct_date >= today && (daysUntil(s.ct_date) ?? 99) <= 3 && !s.scanned
                return (
                  <tr
                    key={s.id}
                    className={classNames(
                      'border-b border-slate-100 align-top',
                      overdueRow && 'bg-red-50/60',
                      soon && !overdueRow && 'bg-amber-50/60',
                    )}
                  >
                    <td className="whitespace-nowrap p-2 text-slate-500">{formatDate(s.entry_date)}</td>
                    <td className="whitespace-nowrap p-2 text-slate-700">{s.hospital?.name}</td>
                    <td className="whitespace-nowrap p-2 font-medium text-slate-800">{s.patient_name}</td>
                    <td className="whitespace-nowrap p-2 text-slate-500" dir="ltr">{s.patient_id_number}</td>
                    <td className="whitespace-nowrap p-2 text-slate-500" dir="ltr">{s.patient_phone}</td>
                    <td className="whitespace-nowrap p-2 text-slate-500">{s.health_fund}</td>
                    <td className="whitespace-nowrap p-2 text-slate-600">{s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : '—'}</td>
                    <td className="whitespace-nowrap p-2 text-slate-600">{SCAN_PROCEDURE_LABELS[s.procedure_type]}</td>
                    <td className="whitespace-nowrap p-2 text-slate-600">{s.side || '—'}</td>
                    <td className="whitespace-nowrap p-2 text-slate-600">
                      {s.ct_date ? `${formatDate(s.ct_date)}${s.ct_time ? ` ${formatTime(s.ct_time)}` : ''}` : '—'}
                    </td>
                    <td className="max-w-[160px] p-2 text-xs text-slate-500">{s.anaesthesia_note || '—'}</td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="h-4 w-4" checked={s.scanned}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { scanned: e.target.checked } })} />
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="h-4 w-4" checked={s.uploaded}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { uploaded: e.target.checked } })} />
                    </td>
                    <td className="max-w-[180px] p-2 text-xs text-slate-500">{implantSummary(s) || '—'}</td>
                    <td className="whitespace-nowrap p-2">
                      <span className="chip border-slate-200 bg-slate-50 text-slate-600">
                        {SCAN_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2">
                      <div className="flex gap-1">
                        <button className="btn-ghost !px-2" onClick={() => setEditing(s)}>
                          <Pencil size={14} />
                        </button>
                        <ConfirmButton className="btn-ghost !px-2 text-red-500" onConfirm={() => del.mutate(s.id)}>
                          <Trash2 size={14} />
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <ScanFormModal onClose={() => setShowAdd(false)} />}
      {editing && <ScanFormModal scan={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
