import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, Copy, Download, FileInput, Plus, X } from 'lucide-react'
import {
  useDeletePatientScan,
  useImplantFields,
  useMakoHospitals,
  usePatchPatientScan,
  usePatientScans,
} from '../lib/api'
import { ScanFormModal, type ScanDraft } from '../components/ScanFormModal'
import { ReferralImportModal } from '../components/ReferralImportModal'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import {
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { QUICK_TESTS, type ScanQuick } from '../lib/scanAlerts'
import { useToday } from '../lib/useToday'
import { ScanCard, type ScanActions } from '../components/ScanCard'
import { ScanRow } from '../components/ScanRow'
import { ScanStatusModal } from '../components/ScanStatusModal'
import { DEFAULT_WINDOW, WINDOW_LABELS, compareByWindow, inWindow, matchesScanQuery, parseScanParams, revealScan, windowSummary, type ScanWindow } from '../lib/scanList'
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
  csvTextDigits,
  formatDate,
  formatTime,
} from '../lib/utils'

/** the alert chips above the list: each one is a one-tap filter for the scans that need attention (who belongs to a chip: QUICK_TESTS) */
const QUICKS: { key: ScanQuick; label: string; tone: string }[] = [
  { key: 'overdue', label: 'CT עבר, לא נסרק', tone: 'border-red-200 bg-red-50 text-red-700' },
  { key: 'noct', label: 'ניתוח השבוע, אין CT', tone: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700' },
  { key: 'nodisk', label: 'ניתוח השבוע, אין דיסק', tone: 'border-orange-200 bg-orange-50 text-orange-700' },
  { key: 'week', label: 'CT בשבוע הקרוב', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  { key: 'open', label: 'חסר טיפול ל-CT', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  { key: 'rescan', label: 'סריקה חוזרת פתוחה', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
  { key: 'postponed', label: 'נדחו', tone: 'border-amber-300 bg-amber-100 text-amber-800' },
  { key: 'nodate', label: 'בלי תאריך ניתוח', tone: 'border-slate-300 bg-slate-100 text-slate-700' },
]

/** a long list shows its first page; "show more" adds the next (300 scans drawn at once are a slow screen) */
const PAGE = 50

function inviteFor(list: PatientScanRow[]) {
  const events = list.flatMap(scanEvents)
  if (events.length === 0) return
  downloadIcs(events, list.length === 1 ? `סריקה-${list[0].patient_name}.ics` : 'סריקות-MAKO.ics')
}

/** a table on a desktop, cards below it — only the one that shows is built (300 scans twice are a slow screen) */
const WIDE = '(min-width: 1024px)'
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(WIDE)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  )
}

export default function Scans() {
  const scans = usePatientScans()
  const makoHospitals = useMakoHospitals()
  const del = useDeletePatientScan()
  const patch = usePatchPatientScan()
  const wide = useWide()
  const implantRows = useImplantFields().data

  const [params] = useSearchParams()
  const link = useMemo(() => parseScanParams(params), [params])

  const [showAdd, setShowAdd] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [prefill, setPrefill] = useState<{ draft: Partial<ScanDraft>; notices: string[] } | null>(null)
  const [editing, setEditing] = useState<PatientScanRow | null>(null)
  const [q, setQ] = useState('')
  // the list follows the typing a moment later, so a long list never makes the box lag
  const dq = useDeferredValue(q)
  const [hospital, setHospital] = useState(link.hospital)
  const [status, setStatus] = useState('')
  const [quick, setQuick] = useState<ScanQuick | ''>('')
  // opens on the surgeries of the next two weeks (from a hospital: the coming month; a link may ask for another window)
  const [window, setWindow] = useState<ScanWindow>(link.window)
  // a scan a link points at: shown, scrolled to and marked for a few seconds
  const [highlight, setHighlight] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [statusFor, setStatusFor] = useState<PatientScanRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const today = useToday()

  const hospitals = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of makoHospitals.data ?? []) m.set(h.id, h.name)
    for (const s of scans.data ?? []) if (s.hospital) m.set(s.hospital.id, s.hospital.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [scans.data, makoHospitals.data])

  const rows = useMemo(() => {
    return (scans.data ?? [])
      .filter((s) => {
        if (hospital && s.hospital_id !== hospital) return false
        if (status && s.status !== status) return false
        if (quick && !QUICK_TESTS[quick](s)) return false
        // a status or an alert chosen on purpose shows what it is about, wherever its date is; otherwise the window of dates decides
        if (!status && !quick && !inWindow(s, window, today)) return false
        if (!matchesScanQuery(s, dq)) return false
        return true
      })
      .sort(compareByWindow(window))
  }, [scans.data, hospital, status, quick, dq, window, today])

  const quickCounts = useMemo(
    () => QUICKS.map((x) => ({ ...x, count: (scans.data ?? []).filter((r) => QUICK_TESTS[x.key](r)).length })),
    // (the tests read the clock: a new day, `today`, counts again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scans.data, today],
  )
  const filtered = !!(q || hospital || status || quick || window !== DEFAULT_WINDOW)

  function clearFilters() {
    setQ('')
    setHospital('')
    setStatus('')
    setQuick('')
    setWindow(DEFAULT_WINDOW)
    setHighlight('')
  }

  // another filter starts the list again from its first page
  useEffect(() => setLimit(PAGE), [hospital, status, quick, dq, window])

  // a link to one scan (?highlight=<id>): the view widens to show it (its hospital, the whole list if its date is outside the window)
  const linkDone = useRef(false)
  useEffect(() => {
    if (linkDone.current || !link.highlight || !scans.data) return
    linkDone.current = true
    const s = scans.data.find((x) => x.id === link.highlight)
    if (!s) return
    const view = revealScan(s, { hospital: link.hospital, window: link.window }, today)
    setHospital(view.hospital)
    setWindow(view.window)
    setHighlight(s.id)
  }, [link, scans.data, today])

  // …the page that holds it is opened, it scrolls into view, and the mark goes away after a few seconds
  useEffect(() => {
    if (!highlight) return
    const at = rows.findIndex((s) => s.id === highlight)
    if (at >= limit) return setLimit(at + 1)
    const t = setTimeout(() => document.getElementById(`scan-${highlight}`)?.scrollIntoView({ block: 'center' }), 50)
    const off = setTimeout(() => setHighlight(''), 6000)
    return () => {
      clearTimeout(t)
      clearTimeout(off)
    }
  }, [highlight, rows, limit, wide])

  const shown = rows.slice(0, limit)
  const selectedRows = rows.filter((s) => selected.has(s.id))
  const allSelected = rows.length > 0 && selectedRows.length === rows.length

  // one stable object for every row, so that a row whose scan did not change is not drawn again
  const { mutate: patchScan } = patch
  const { mutate: deleteScan } = del
  const actions = useMemo<ScanActions>(
    () => ({
      toggle: (id) =>
        setSelected((cur) => {
          const n = new Set(cur)
          if (n.has(id)) n.delete(id)
          else n.add(id)
          return n
        }),
      edit: setEditing,
      status: setStatusFor,
      invite: (s) => inviteFor([s]),
      remove: (s) => deleteScan(s.id),
      patch: (id, p) => patchScan({ id, patch: p }),
    }),
    [patchScan, deleteScan],
  )

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((s) => s.id)))
  }

  async function copySelected() {
    if (await copyText(scansToText(selectedRows))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function exportCsv() {
    // the file leaves the system with details of patients: say so before it is created
    if (!globalThis.confirm(`הקובץ יכלול שם, ת״ז, טלפון ותאריך לידה של ${rows.length} מטופלים, וישמר במכשיר. לייצא?`)) return
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
    // the ID and the phone (columns 3 and 4) stay text in Excel: a leading zero is not dropped
    const csv = [head, ...body]
      .map((r) => r.map((c, i) => (i === 3 || i === 4 ? csvTextDigits(c) : csvCell(c))).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'סריקות-MAKO.csv'
    a.click()
    // (a phone browser starts the download a moment after the click)
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
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
            'chip !min-h-[40px] shrink-0 whitespace-nowrap',
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
              className={classNames('chip !min-h-[40px] shrink-0 whitespace-nowrap', x.tone, quick === x.key && 'font-bold ring-2 ring-current')}
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
          <span className="shrink-0 text-sm text-slate-500" aria-hidden="true">ניתוח</span>
          <div role="group" aria-label="טווח תאריך הניתוח" className="grid flex-1 grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1 md:flex-none">
            {(Object.entries(WINDOW_LABELS) as [ScanWindow, string][]).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={window === v}
                onClick={() => setWindow(v)}
                className={classNames(
                  'min-h-[40px] rounded-lg px-2 text-sm font-medium transition md:px-3',
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
      {scans.error && !scans.data && <ErrorState error={scans.error} />}
      {scans.data && rows.length === 0 && (
        <EmptyState
          title={filtered ? 'אין סריקות שמתאימות לסינון' : scans.data.length > 0 ? 'אין ניתוחים מתוכננים בשבועיים הקרובים' : 'אין סריקות'}
          hint={filtered ? 'נסה לשנות או לנקות את הסינון' : scans.data.length > 0 ? 'ניתוחים שבוצעו, נדחו או רחוקים יותר מופיעים בטווח "הכל"' : 'הוסף מטופל או ייבא הפנייה'}
          action={
            !filtered && scans.data.length > 0 ? (
              <button className="btn-secondary" onClick={() => setWindow('all')}>הצג את כל הסריקות</button>
            ) : filtered ? (
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
            {!status && !quick && <span className="text-slate-500"> · {windowSummary(window, today)}</span>}
            {filtered && (
              <button className="me-3 ms-3 inline-flex items-center gap-1 text-brand-600 underline" onClick={clearFilters}>
                <X size={14} aria-hidden="true" />
                נקה סינון
              </button>
            )}
          </span>
          <label className="flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap lg:hidden">
            <input type="checkbox" className="h-5 w-5" checked={allSelected} onChange={toggleAll} />
            בחר הכל
          </label>
        </div>
      )}

      {rows.length > 0 && !wide && (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((s) => (
            <ScanCard key={s.id} s={s} selected={selected.has(s.id)} highlighted={highlight === s.id} implantRows={implantRows} today={today} actions={actions} />
          ))}
        </div>
      )}

      {rows.length > 0 && wide && (
        <div tabIndex={0} className="card relative overflow-x-auto" role="region" aria-label="טבלת הסריקות">
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
              {shown.map((s) => (
                <ScanRow key={s.id} s={s} selected={selected.has(s.id)} highlighted={highlight === s.id} implantRows={implantRows} today={today} actions={actions} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > shown.length && (
        <div className="flex justify-center">
          <button type="button" className="btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
            הצג עוד ({rows.length - shown.length})
          </button>
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
      {statusFor && <ScanStatusModal scan={statusFor} onClose={() => setStatusFor(null)} />}
    </div>
  )
}
