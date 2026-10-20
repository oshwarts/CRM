import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, Copy, Download, FileInput, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  useDeletePatientScan,
  useImplantFields,
  useMakoHospitals,
  usePatchPatientScan,
  usePatientScans,
} from '../lib/api'
import { ScanFormModal, type ScanDraft } from '../components/ScanFormModal'
import { ReferralImportModal } from '../components/ReferralImportModal'
import { ConfirmButton, EmptyState, ErrorState, Spinner } from '../components/ui'
import {
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { rowFlags, weekMissing } from '../lib/scanAlerts'
import { ScanCard } from '../components/ScanCard'
import { MaskedValue } from '../components/MaskedValue'
import {
  copyText,
  downloadIcs,
  implantSummary,
  scanEvents,
  scansToText,
} from '../lib/scanExport'
import {
  classNames,
  csvCell,
  daysUntil,
  formatDate,
  formatTime,
  plusDaysISO,
  todayISO,
} from '../lib/utils'

/** the date window filters the CT date */
const WINDOW_LABELS: Record<string, string> = {
  all: 'הכל',
  week: 'השבוע',
  month: 'החודש',
  past: 'עבר',
}

type Quick = 'week' | 'overdue' | 'noct' | 'nodisk' | 'open' | 'rescan'

/** the alert chips above the list: each one is a one-tap filter for the scans that need attention */
const QUICKS: { key: Quick; label: string; tone: string; test: (s: PatientScanRow, today: string) => boolean }[] = [
  {
    key: 'overdue',
    label: 'CT עבר, לא נסרק',
    tone: 'border-red-200 bg-red-50 text-red-700',
    test: (s, today) => !!s.ct_date && s.ct_date < today && !s.scanned && s.status !== 'cancelled',
  },
  {
    key: 'noct',
    label: 'ניתוח השבוע, אין CT',
    tone: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    test: (s, today) =>
      s.status !== 'cancelled' && !!s.surgery_date && s.surgery_date >= today && (daysUntil(s.surgery_date) ?? 99) <= 7 && !s.ct_date,
  },
  {
    key: 'nodisk',
    label: 'ניתוח השבוע, אין דיסק',
    tone: 'border-orange-200 bg-orange-50 text-orange-700',
    test: (s, today) =>
      s.status !== 'cancelled' &&
      !!s.surgery_date &&
      s.surgery_date >= today &&
      (daysUntil(s.surgery_date) ?? 99) <= 7 &&
      !!s.ct_date &&
      !s.disk_collected,
  },
  {
    key: 'week',
    label: 'CT בשבוע הקרוב',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
    test: (s, today) => !!s.ct_date && s.ct_date >= today && (daysUntil(s.ct_date) ?? 99) <= 7 && !s.scanned,
  },
  {
    key: 'open',
    label: 'חסר טיפול ל-CT',
    tone: 'border-sky-200 bg-sky-50 text-sky-700',
    test: (s) => weekMissing(s).length > 0,
  },
  {
    key: 'rescan',
    label: 'סריקה חוזרת פתוחה',
    tone: 'border-rose-200 bg-rose-50 text-rose-700',
    test: (s) => s.rescan && !s.rescan_done && s.status !== 'cancelled',
  },
]

export default function Scans() {
  const scans = usePatientScans()
  const makoHospitals = useMakoHospitals()
  const del = useDeletePatientScan()
  const patch = usePatchPatientScan()
  const implantRows = useImplantFields().data

  const [params] = useSearchParams()
  const hospitalParam = params.get('hospital') ?? ''

  const [showAdd, setShowAdd] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [prefill, setPrefill] = useState<{ draft: Partial<ScanDraft>; notices: string[] } | null>(null)
  const [editing, setEditing] = useState<PatientScanRow | null>(null)
  const [q, setQ] = useState('')
  const [hospital, setHospital] = useState(hospitalParam)
  const [status, setStatus] = useState('')
  const [quick, setQuick] = useState<Quick | ''>('')
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
      if (quick && !QUICKS.find((x) => x.key === quick)?.test(s, today)) return false
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
  }, [scans.data, hospital, status, quick, q, window, today, monthEnd, weekEnd])

  const quickCounts = useMemo(
    () => QUICKS.map((x) => ({ ...x, count: (scans.data ?? []).filter((r) => x.test(r, today)).length })),
    [scans.data, today],
  )
  const filtered = !!(q || hospital || status || quick || window !== 'all')

  function clearFilters() {
    setQ('')
    setHospital('')
    setStatus('')
    setQuick('')
    setWindow('all')
  }

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
      'מנתח', 'סוג', 'רגל', 'תאריך CT', 'שעת CT', 'מרדים', 'נסרק', 'הועלה דיסק', 'תוכנית מוכנה',
      'סריקה חוזרת', 'תאריך סריקה חוזרת', 'סיבת סריקה חוזרת', 'מידות שתל', 'סטטוס', 'הערות',
    ]
    const body = rows.map((s) => [
      formatDate(s.surgery_date), s.hospital?.name ?? '', s.patient_name, s.patient_id_number,
      s.patient_phone, formatDate(s.patient_dob), s.health_fund, s.insurance,
      s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : '',
      SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type, s.side,
      formatDate(s.ct_date), formatTime(s.ct_time), s.anaesthesia_note,
      s.scanned ? 'כן' : 'לא', s.disk_collected ? 'כן' : 'לא', s.plan_ready ? 'כן' : 'לא',
      s.rescan ? (s.rescan_done ? 'בוצעה' : 'כן') : '', formatDate(s.rescan_date), s.rescan_reason,
      implantSummary(s, implantRows), SCAN_STATUS_LABELS[s.status] ?? s.status, s.notes,
    ])
    const csv = [head, ...body]
      .map((r) => r.map(csvCell).join(','))
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">סריקות MAKO</h1>
          <p className="text-sm text-slate-500">
            מעקב סריקות CT למטופלי MAKO — כל בתי החולים יחד
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button className="btn-primary flex-1 sm:flex-none" onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            הוסף מטופל
          </button>
          <button className="btn-secondary flex-1 sm:flex-none" onClick={() => setShowReferral(true)}>
            <FileInput size={16} />
            ייבוא הפנייה
          </button>
          <button className="btn-secondary !px-3 sm:!px-5" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={16} />
            <span className="sr-only sm:not-sr-only">ייצוא CSV</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden" role="group" aria-label="סינון מהיר לפי התראות">
        <button
          type="button"
          aria-pressed={quick === ''}
          onClick={() => setQuick('')}
          className={classNames(
            'chip shrink-0 whitespace-nowrap',
            quick === '' ? 'border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-400' : 'border-slate-200 bg-white text-slate-600',
          )}
        >
          הכל · {scans.data?.length ?? 0}
        </button>
        {quickCounts
          .filter((x) => x.count > 0 || quick === x.key)
          .map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={quick === x.key}
              onClick={() => setQuick(quick === x.key ? '' : x.key)}
              className={classNames('chip shrink-0 whitespace-nowrap', x.tone, quick === x.key && 'font-bold ring-2 ring-current')}
            >
              {x.label} · {x.count}
            </button>
          ))}
      </div>

      <div className="card space-y-2 p-3 md:flex md:flex-wrap md:items-center md:gap-3 md:space-y-0 md:p-4">
        <input className="input md:w-64" aria-label="חיפוש" placeholder="חיפוש שם, ת״ז, טלפון, מנתח" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="grid grid-cols-2 gap-2 md:contents">
          <select className="input min-w-0 md:w-52" aria-label="בית חולים" value={hospital} onChange={(e) => setHospital(e.target.value)}>
            <option value="">כל בתי החולים</option>
            {hospitals.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select className="input min-w-0 md:w-40" aria-label="סטטוס" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">כל הסטטוסים</option>
            {Object.entries(SCAN_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 md:ms-auto">
          <span className="shrink-0 text-sm text-slate-500" aria-hidden="true">תאריך CT</span>
          <div role="group" aria-label="טווח תאריך CT" className="grid flex-1 grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 md:flex-none">
            {Object.entries(WINDOW_LABELS).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={window === v}
                onClick={() => setWindow(v)}
                className={classNames(
                  'min-h-[36px] rounded-lg px-2 text-sm font-medium transition md:px-3',
                  window === v ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-800',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {scans.isLoading && <Spinner />}
      {scans.error && <ErrorState error={scans.error} />}
      {scans.data && rows.length === 0 && (
        <EmptyState
          title={filtered ? 'אין סריקות שמתאימות לסינון' : 'אין סריקות'}
          hint={filtered ? 'נסה לשנות או לנקות את הסינון' : 'הוסף מטופל או ייבא הפנייה'}
          action={
            filtered ? (
              <button className="btn-secondary" onClick={clearFilters}>נקה סינון</button>
            ) : (
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} />
                הוסף מטופל
              </button>
            )
          }
        />
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-1 text-sm text-slate-600">
          <span>
            {rows.length} מטופלים
            {filtered && (
              <button className="me-3 ms-3 inline-flex items-center gap-1 text-brand-600 underline" onClick={clearFilters}>
                <X size={14} aria-hidden="true" />
                נקה סינון
              </button>
            )}
          </span>
          <label className="flex min-h-[32px] items-center gap-2 lg:hidden">
            <input type="checkbox" className="h-5 w-5" checked={allSelected} onChange={toggleAll} />
            בחר הכל
          </label>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:hidden">
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
        <div tabIndex={0} className="card relative hidden overflow-x-auto lg:block" role="region" aria-label="טבלת הסריקות">
          <table className="w-full min-w-[1250px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-slate-500">
                <th className="p-2">
                  <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={toggleAll} title="בחר הכל" aria-label="בחר הכל" />
                </th>
                {['ניתוח', 'בית חולים', 'שם מלא', 'ת״ז', 'טלפון', 'קופה', 'מנתח', 'סוג', 'רגל', 'CT', 'מרדים', 'נסרק', 'הועלה דיסק', 'תוכנית מוכנה', 'מידות שתל', 'סטטוס', 'פעולות'].map((h) => (
                  <th key={h} className="whitespace-nowrap p-2 font-medium">{h === 'פעולות' ? <span className="sr-only">{h}</span> : h}</th>
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
                      <input type="checkbox" className="h-4 w-4" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} aria-label={`בחר את ${s.patient_name}`} />
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
                          title="ניתוח בשבוע הקרוב — הדיסק לא הועלה"
                          className="mr-1 chip border-orange-200 bg-orange-100 text-orange-700"
                        >
                          אין דיסק
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-2 text-slate-700">{s.hospital?.name}</td>
                    <td className="whitespace-nowrap p-2 font-medium text-slate-800">{s.patient_name}</td>
                    <td className="whitespace-nowrap p-2 text-slate-500">
                      <MaskedValue value={s.patient_id_number} />
                    </td>
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
                      <input type="checkbox" className="h-4 w-4" aria-label={`${s.patient_name}: נסרק`} checked={s.scanned}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { scanned: e.target.checked } })} />
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="h-4 w-4" aria-label={`${s.patient_name}: הועלה דיסק`} checked={s.disk_collected}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { disk_collected: e.target.checked } })} />
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" className="h-4 w-4" aria-label={`${s.patient_name}: תוכנית מוכנה`} checked={s.plan_ready}
                        onChange={(e) => patch.mutate({ id: s.id, patch: { plan_ready: e.target.checked } })} />
                    </td>
                    <td className="max-w-[180px] p-2 text-xs text-slate-500">{implantSummary(s, implantRows) || '—'}</td>
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
                          aria-label={`זימון Outlook: ${s.patient_name}`}
                          disabled={!hasEvents}
                          onClick={() => inviteFor([s])}
                        >
                          <CalendarPlus size={14} />
                        </button>
                        <button className="btn-ghost !px-2" onClick={() => setEditing(s)} aria-label="עריכה" title="עריכה">
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

      {selectedRows.length > 0 && (
        <div
          role="region"
          aria-label="פעולות על המטופלים שנבחרו"
          className="card sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 space-y-2 border-brand-200 bg-brand-50 p-3 shadow-lg md:bottom-4 md:flex md:items-center md:space-y-0"
        >
          <div className="flex items-center justify-between gap-2 md:contents">
            <span className="text-sm font-semibold text-slate-800 md:me-2">{selectedRows.length} נבחרו</span>
            <button className="btn-ghost md:order-last" onClick={() => setSelected(new Set())}>
              <X size={16} aria-hidden="true" />
              נקה בחירה
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
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
          </div>
        </div>
      )}

      {showAdd && <ScanFormModal onClose={() => setShowAdd(false)} />}
      {showReferral && (
        <ReferralImportModal
          onClose={() => setShowReferral(false)}
          onResult={(draft, notices) => {
            setShowReferral(false)
            setPrefill({ draft, notices })
          }}
        />
      )}
      {prefill && (
        <ScanFormModal initial={prefill.draft} notices={prefill.notices} onClose={() => setPrefill(null)} />
      )}
      {editing && <ScanFormModal scan={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
