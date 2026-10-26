import { memo } from 'react'
import { ScanContactLine } from './ScanCoordination'
import { CalendarClock, CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { ConfirmButton } from './ui'
import { MaskedValue } from './MaskedValue'
import { PendingMark } from './PendingMark'
import { deleteMessage, type ScanActions } from './ScanCard'
import { rowFlags } from '../lib/scanAlerts'
import { implantSummary } from '../lib/scanExport'
import { SCAN_PROCEDURE_LABELS, SCAN_STATUS_LABELS, type ImplantField, type PatientScanRow } from '../lib/types'
import { classNames, formatDate, formatTime } from '../lib/utils'

/** one row of the table of scans (desktop). Drawn again only when its own scan, selection or the day changes. */
export const ScanRow = memo(function ScanRow({
  s,
  selected,
  highlighted,
  implantRows,
  actions,
}: {
  s: PatientScanRow
  selected: boolean
  highlighted: boolean
  implantRows: ImplantField[] | null | undefined
  /** only here so that a row is drawn again when the day changes */
  today: string
  actions: ScanActions
}) {
  const { overdueRow, soon, noCtSoon, noDiskSoon, missing, rescanKind, hasEvents } = rowFlags(s)
  return (
    <tr
      id={`scan-${s.id}`}
      className={classNames(
        'border-b border-slate-100 align-top',
        selected && 'outline outline-1 -outline-offset-1 outline-brand-300',
        highlighted && 'ring-2 ring-inset ring-brand-500',
        noCtSoon && 'bg-fuchsia-50/60',
        !noCtSoon && noDiskSoon && 'bg-orange-50/60',
        !noCtSoon && !noDiskSoon && overdueRow && 'bg-red-50/60',
        !noCtSoon && !noDiskSoon && !overdueRow && (rescanKind === 'today' || rescanKind === 'overdue') && 'bg-rose-50/70',
        !noCtSoon && !noDiskSoon && !overdueRow && !rescanKind && missing.length > 0 && 'bg-sky-50/60',
        !noCtSoon && !noDiskSoon && !overdueRow && !rescanKind && missing.length === 0 && soon && 'bg-amber-50/60',
      )}
    >
      <td className="p-2">
        <input type="checkbox" className="h-4 w-4" checked={selected} onChange={() => actions.toggle(s.id)} aria-label={`בחר את ${s.patient_name}`} />
      </td>
      <td className="whitespace-nowrap p-2 text-slate-500">
        {formatDate(s.surgery_date)}
        {noCtSoon && (
          <span title="ניתוח בשבוע הקרוב — אין תאריך CT מתואם" className="ms-1 chip border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700">
            אין CT
          </span>
        )}
        {!noCtSoon && noDiskSoon && (
          <span title="ניתוח בשבוע הקרוב — הדיסק לא הועלה" className="ms-1 chip border-orange-200 bg-orange-100 text-orange-700">
            אין דיסק
          </span>
        )}
      </td>
      <td className="whitespace-nowrap p-2 text-slate-700">
        {s.hospital?.name}
        <ScanContactLine hospitalId={s.hospital_id} className="text-xs text-slate-500" />
      </td>
      <td className="whitespace-nowrap p-2 font-medium text-slate-800">{s.patient_name} <PendingMark id={s.id} /></td>
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
              s.rescan_done ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-rose-200 bg-rose-100 text-rose-700',
            )}
          >
            {s.rescan_done ? 'סריקה חוזרת בוצעה' : `סריקה חוזרת ${s.rescan_date ? formatDate(s.rescan_date) : '— ללא תאריך'}`}
          </div>
        )}
      </td>
      <td className="max-w-[160px] p-2 text-xs text-slate-500">{s.anaesthesia_note || '—'}</td>
      <td className="p-2 text-center">
        <input type="checkbox" className="h-4 w-4" aria-label={`${s.patient_name}: נסרק`} checked={s.scanned}
          onChange={(e) => actions.patch(s.id, { scanned: e.target.checked })} />
      </td>
      <td className="p-2 text-center">
        <input type="checkbox" className="h-4 w-4" aria-label={`${s.patient_name}: הועלה דיסק`} checked={s.disk_collected}
          onChange={(e) => actions.patch(s.id, { disk_collected: e.target.checked })} />
      </td>
      <td className="p-2 text-center">
        <input type="checkbox" className="h-4 w-4" aria-label={`${s.patient_name}: תוכנית מוכנה`} checked={s.plan_ready}
          onChange={(e) => actions.patch(s.id, { plan_ready: e.target.checked })} />
      </td>
      <td className="max-w-[180px] p-2 text-xs text-slate-500">{implantSummary(s, implantRows) || '—'}</td>
      <td className="whitespace-nowrap p-2">
        <span className={classNames('chip', s.status === 'postponed' ? 'border-amber-300 bg-amber-100 text-amber-800' : s.status === 'cancelled' ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-600')}>
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
            onClick={() => actions.invite(s)}
          >
            <CalendarPlus size={14} />
          </button>
          <button className="btn-ghost !px-2" onClick={() => actions.status(s)} aria-label={`נדחה, בוטל או בוצע: ${s.patient_name}`} title="נדחה / בוטל / בוצע">
            <CalendarClock size={14} />
          </button>
          <button className="btn-ghost !px-2" onClick={() => actions.edit(s)} aria-label={`עריכת ${s.patient_name}`} title="עריכה">
            <Pencil size={14} />
          </button>
          <ConfirmButton
            className="btn-ghost !px-2 text-red-500"
            label={`מחיקת ${s.patient_name}`}
            message={deleteMessage(s.patient_name)}
            onConfirm={() => actions.remove(s)}
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </td>
    </tr>
  )
})
