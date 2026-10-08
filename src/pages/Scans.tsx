import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, Copy, Download, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useDeletePatientScan,
  useMakoHospitals,
  usePatchPatientScan,
  usePatientScans,
} from '../lib/api'
import { ScanFormModal } from '../components/ScanFormModal'
import { ConfirmButton, EmptyState, ErrorState, Spinner } from '../components/ui'
import {
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { rowFlags, weekMissing } from '../lib/scanAlerts'
import { ScanCard } from '../components/ScanCard'
import {
  copyText,
  downloadIcs,
  implantSummary,
  scanEvents,
  scansToText,
} from '../lib/scanExport'
import {
  classNames,
  daysUntil,
  formatDate,
  formatTime,
  plusDaysISO,
  todayISO,
} from '../lib/utils'

const WINDOW_LABELS: Record<string, string> = {
  all: 'כל התאריכים',
  month: 'החודש הקרוב',
  week: 'השבוע הקרוב',
  past: 'עבר',
}

export default function Scans() {
  const scans = usePatientScans()
  const makoHospitals = useMakoHospitals()
  const del = useDeletePatientScan()
  const patch = usePatchPatientScan()

  const [params] = useSearchParams()
  const hospitalParam = params.get('hospital') ?? ''

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<PatientScanRow | null>(null)
  const [q, setQ] = useState('')
  const [hospital, setHospital] = useState(hospitalParam)
  const [status, setStatus] = useState('')
  // arriving from a hospital → default to the coming month
  const [window, setWindow] = useState(hospitalParam ? 'month' : 'all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const today = todayISO()
  const monthEnd = plusDaysISO(30)
  const weekEnd = plusDaysISO(7)

  const hospitals = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of makoHospitals.data ?? []) m.set(h.id, h.name)
    for (const s of scans.data ?? []) if (s.hospital) m.set(s.hospital.id, s.hospital.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [scans.data, makoHospitals.data])

  const rows = useMemo(() => {
    return (scans.data ?? []).filter((s) => {
      if (hospital && s.hospital_id !== hospital) return false
      if (status && s.status !== status) return false
      if (window !== 'all') {
        const c = s.ct_date
        if (!c) return false
        if (window === 'month' && !(c >= today && c <= monthEnd)) return false
        if (window === 'week' && !(c >= today && c <= weekEnd)) return false
        if (window === 'past' && !(c < today)) return false
      }
      if (q) {
        const hay = `${s.patient_name} ${s.patient_id_number} ${s.patient_phone} ${s.surgeon?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [scans.data, hospital, status, q, window, today, monthEnd, weekEnd])

  const upcoming = (scans.data ?? []).filter(
    (s) => s.ct_date && s.ct_date >= today && (daysUntil(s.ct_date) ?? 99) <= 7 && !s.scanned,
  ).length
  const overdue = (scans.data ?? []).filter(
    (s) => s.ct_date && s.ct_date < today && !s.scanned && s.status !== 'cancelled',
  ).length
  const noCtSoonCount = (scans.data ?? []).filter(
    (s) =>
      s.status !== 'cancelled' &&
      s.surgery_date &&
      s.surgery_date >= today &&
      (daysUntil(s.surgery_date) ?? 99) <= 7 &&
      !s.ct_date,
  ).length
  const noDiskSoonCount = (scans.data ?? []).filter(
    (s) =>
      s.status !== 'cancelled' &&
      s.surgery_date &&
      s.surgery_date >= today &&
      (daysUntil(s.surgery_date) ?? 99) <= 7 &&
      !!s.ct_date &&
      !s.disk_collected,
  ).length
  const weekOpenCount = (scans.data ?? []).filter((s) => weekMissing(s).length > 0).length
  const rescanOpenCount = (scans.data ?? []).filter((s) => s.rescan && !s.rescan_done && s.status !== 'cancelled').length

  const selectedRows = rows.filter((s) => selected.has(s.id))
  const allSelected = rows.length > 0 && selectedRows.length === rows.length

  function toggleOne(id: string) {
    setSelected((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((s) => s.id)))
  }

  async function copySelected() {
    if (await copyText(scansToText(selectedRows))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function inviteFor(list: PatientScanRow[]) {
    const events = list.flatMap(scanEvents)
    if (events.length === 0) return
    downloadIcs(events, list.length === 1 ? `סריקה-${list[0].patient_name}.ics` : 'סריקות-MAKO.ics')
  }

  function exportCsv() {
    const head = [
      'תאריך ניתוח', 'בית חולים', 'שם מלא', 'תז', 'טלפון', 'תאריך לידה', 'קופה', 'ביטוח',
      'מנתח', 'סוג', 'רגל', 'תאריך CT', 'שעת CT', 'מרדים', 'נסרק', 'דיסק נאסף', 'תוכנית מוכנה',
      'סריקה חוזרת', 'תאריך סריקה חוזרת', 'סיבת סריקה חוזרת', 'הועלה', 'מידות שתל', 'סטטוס', 'הערות',
    ]
    const body = rows.map((s) => [
      formatDate(s.surgery_date), s.hospital?.name ?? '', s.patient_name, s.patient_id_number,
      s.patient_phone, formatDate(s.patient_dob), s.health_fund, s.insurance,
      s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : '',
      SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type, s.side,
      formatDate(s.ct_date), formatTime(s.ct_time), s.anaesthesia_note,
      s.scanned ? 'כן' : 'לא', s.disk_collected ? 'כן' : 'לא', s.plan_ready ? 'כן' : 'לא',
      s.rescan ? (s.rescan_done ? 'בוצעה' : 'כן') : '', formatDate(s.rescan_date), s.rescan_reason,
      s.uploaded ? 'כן' : 'לא',
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
        {noCtSoonCount > 0 && (
          <span className="chip border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">
            ניתוח השבוע ללא CT מתואם · {noCtSoonCount}
          </span>
        )}
        {noDiskSoonCount > 0 && (
          <span className="chip border-orange-200 bg-orange-50 text-orange-700">
            ניתוח השבוע — דיסק לא נאסף · {noDiskSoonCount}
          </span>
        )}
        {weekOpenCount > 0 && (
          <span className="chip border-sky-200 bg-sky-50 text-sky-700">
            CT בשבוע הקרוב — חסר טיפול · {weekOpenCount}
          </span>
        )}
        {rescanOpenCount > 0 && (
          <span className="chip border-rose-200 bg-rose-50 text-rose-700">
            סריקות חוזרות פתוחות · {rescanOpenCount}
          </span>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 border-brand-200 bg-brand-50/50 p-3">
          <span className="text-sm font-medium text-slate-700">{selectedRows.length} נבחרו</span>
          <button className="btn-secondary" onClick={copySelected}>
            <Copy size={16} />
            {copied ? 'הועתק ✓' : 'העתק נתונים'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => inviteFor(selectedRows)}
            disabled={!selectedRows.some((s) => s.ct_date || (s.rescan && s.rescan_date))}
          >
            <CalendarPlus size={16} />
            זימון Outlook
          </button>
          <button className="btn-ghost" onClick={() => setSelected(new Set())}>נקה בחירה</button>
        </div>
      )}

      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <input className="input" placeholder="חיפוש שם / ת״ז / טלפון / מנתח" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={hospital} onChange={(e) => setHospital(e.target.value)}>
          <option value="">כל בתי החולים</option>
          {hospitals.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select className="input" value={window} onChange={(e) => setWindow(e.target.value)}>
          {Object.entries(WINDOW_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
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
        <div className="space-y-3 md:hidden">
          <label className="flex items-center gap-2 px-1 text-sm text-slate-500">
            <input type="checkbox" className="h-5 w-5" checked={allSelected} onChange={toggleAll} />
            בחר הכל ({rows.length})
          </label>
          {rows.map((s) => (
            <ScanCard
              key={s.id}
              s={s}
              selected={selected.has(s.id)}
              onToggle={() => toggleOne(s.id)}
              onEdit={() => setEditing(s)}
              onInvite={() => inviteFor([s])}
              onDelete={() => del.mutate(s.id)}
              onPatch={(p) => patch.mutate({ id: s.id, patch: p })}
            />
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1250px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-slate-500">
                <th className="p-2">
                  <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleAll} title="בחר הכל" />
                </th>
                {['ניתוח', 'בית חולים', 'שם מלא', 'ת״ז', 'טלפון', 'קופה', 'מנתח', 'סוג', 'רגל', 'CT', 'מרדים', 'נסרק', 'דיסק', 'תוכנית', 'הועלה', 'מידות שתל', 'סטטוס', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap p-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const { overdueRow, soon, noCtSoon, noDiskSoon, missing, rescanKind, hasEvents } = rowFlags(s)
                return (
                  <tr
                    key={s.id}
                    className={classNames(
                      'border-b border-slate-100 align-top',
                      selected.has(s.id) && 'outline outline-1 -outline-offset-1 outline-brand-300',
                      noCtSoon && 'bg-fuchsia-50/60',
                      !noCtSoon && noDiskSoon && 'bg-orange-50/60',
                      !noCtSoon && !noDiskSoon && overdueRow && 'bg-red-50/60',
                      !noCtSoon && !noDiskSoon && !overdueRow && (rescanKind === 'today' || rescanKind === 'overdue') && 'bg-rose-50/70',
                      !noCtSoon && !noDiskSoon && !overdueRow && !rescanKind && missing.length > 0 && 'bg-sky-50/60',
                      !noCtSoon && !noDiskSoon && !overdueRow && !rescanKind && missing.length === 0 && soon && 'bg-amber-50/60',
                    )}
                  >
                    <td className="p-2">
                      <input type="checkbox" className="h-4 w-4" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                    </td>
                    <td className="whitespace-nowrap p-2 text-slate-500">
                      {formatDate(s.surgery_date)}
                      {noCtSoon && (
                        <span
                          title="ניתוח בשבוע הקרוב — אין תאריך CT מתואם"
                          className="mr-1 chip border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700"
                        >
                          אין CT
                        </span>
                      )}
                      {!noCtSoon && noDiskSoon && (
                        <span
                          title="ניתוח בשבוע הקרוב — הדיסק לא נאסף"
                          className="mr-1 chip border-orange-200 bg-orange-100 text-orange-700"
                        >
                          אין דיסק
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-2 text-slate-700">{s.hospital?.name}</td>
                    <td className="whitespace-nowrap p-2 font-medium text-slate-800">{s.patient_name}</td>
                    <td className="whitespace-nowrap p-2 text-slate-500" dir="ltr">{s.patient_id_number}</td>
                    <td className="whitespace-nowrap p-2 text-slate-500" dir="ltr">{s.patient_phone}</td>
                    <td className="whitespace-nowrap p-2 text-slate-500">{s.health_fund}</td>
                    <td className="whitespace-nowrap p-2 text-slate-600">{s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : '—'}</td>
                    <td className="whitespace-nowrap p-2 text-slate-600">{SCAN_PROCEDURE_LABELS[s.procedure_type]}</td>
                    <td className="whitespace-nowrap p-2 text-slate-600">{s.side || '—'}</td>
                    <td className="p-2 text-slate-600">
                      <div className="whitespace-nowrap">
                        {s.ct_date ? `${formatDate(s.ct_date)}${s.ct_time ? ` ${formatTime(s.ct_time)}` : ''}` : '—'}
                      </div>
                      {missing.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {missing.map((m) => (
                            <span key={m} className="chip border-sky-200 bg-sky-100 text-sky-700">{m}</span>
                          ))}
                        </div>
                      )}
                      {s.rescan && (
                        <div
                          title={s.rescan_reason || undefined}
                          className={classNames(
                            'chip mt-1 whitespace-nowrap',
                            s.rescan_done
                              ? 'border-slate-200 bg-slate-50 text-slate-500'
                              : 'border-rose-200 bg-rose-100 text-rose-700',
                          )}
                        >
                          {s.rescan_done ? 'סריקה חוזרת בוצעה' : `סריקה חוזרת ${s.rescan_date ? formatDate(s.rescan_date) : '— ללא תאריך'}`}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[160px] p-2 text-xs text-slate-500">{s.anaesthesia_note || '—'}</td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="h-4 w-4" checked={s.scanned}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { scanned: e.target.checked } })} />
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="h-4 w-4" checked={s.disk_collected}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { disk_collected: e.target.checked } })} />
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="h-4 w-4" checked={s.plan_ready}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { plan_ready: e.target.checked } })} />
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
                        <button
                          className="btn-ghost !px-2 disabled:opacity-30"
                          title="זימון Outlook (קובץ .ics)"
                          disabled={!hasEvents}
                          onClick={() => inviteFor([s])}
                        >
                          <CalendarPlus size={14} />
                        </button>
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
