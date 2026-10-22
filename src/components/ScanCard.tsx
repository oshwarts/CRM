import { CalendarClock, CalendarPlus, Check, Pencil, Phone, Trash2 } from 'lucide-react'
import { PendingMark } from './PendingMark'
import { ConfirmButton } from './ui'
import { rowFlags } from '../lib/scanAlerts'
import { implantSummary } from '../lib/scanExport'
import { useImplantFields } from '../lib/api'
import {
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { classNames, daysUntil, formatDate, formatTime } from '../lib/utils'

type Patch = Partial<
  Pick<PatientScanRow, 'scanned' | 'disk_collected' | 'plan_ready'>
>

const TOGGLES: { key: keyof Patch; label: string }[] = [
  { key: 'scanned', label: 'נסרק' },
  { key: 'disk_collected', label: 'דיסק הועלה' },
  { key: 'plan_ready', label: 'תוכנית מוכנה' },
]

/** "today", "in 3 days", "2 days ago" — only while the scan is still open */
function relDays(d: number | null): string {
  if (d === null) return ''
  if (d === 0) return 'היום'
  if (d === 1) return 'מחר'
  if (d === -1) return 'אתמול'
  return d > 0 ? `בעוד ${d} ימים` : `לפני ${-d} ימים`
}

const ICON_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40'

export function ScanCard({
  s,
  selected,
  onToggle,
  onEdit,
  onStatus,
  onInvite,
  onDelete,
  onPatch,
}: {
  s: PatientScanRow
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  /** postponed / cancelled / done: what happened to the surgery */
  onStatus: () => void
  onInvite: () => void
  onDelete: () => void
  onPatch: (p: Patch) => void
}) {
  const { overdueRow, soon, noCtSoon, noDiskSoon, missing, rescanKind, hasEvents } = rowFlags(s)
  const implantRows = useImplantFields().data
  const implants = implantSummary(s, implantRows)
  const tone = noCtSoon
    ? 'border-fuchsia-300 bg-fuchsia-50/60'
    : noDiskSoon
      ? 'border-orange-300 bg-orange-50/60'
      : overdueRow
        ? 'border-red-300 bg-red-50/60'
        : rescanKind === 'today' || rescanKind === 'overdue'
          ? 'border-rose-300 bg-rose-50/70'
          : missing.length > 0
            ? 'border-sky-300 bg-sky-50/60'
            : soon
              ? 'border-amber-300 bg-amber-50/60'
              : 'border-slate-200 bg-white'

  const ctDays = s.ct_date ? daysUntil(s.ct_date) : null
  const ctRel = !s.scanned && s.status !== 'cancelled' ? relDays(ctDays) : ''
  const ctUrgent = ctDays !== null && !s.scanned && s.status !== 'cancelled' && ctDays <= 0
  const what = [SCAN_PROCEDURE_LABELS[s.procedure_type], s.side].filter(Boolean).join(' ')
  const surgeon = s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : ''
  const hasAlerts = noCtSoon || noDiskSoon || missing.length > 0 || s.rescan

  return (
    <article className={classNames('rounded-2xl border p-3 shadow-sm', tone, selected && 'ring-2 ring-brand-400')}>
      <div className="flex items-start gap-2">
        <label className="-my-1 flex h-9 w-8 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={selected}
            onChange={onToggle}
            aria-label={`בחר את ${s.patient_name}`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 text-base font-semibold leading-snug text-slate-800 [overflow-wrap:anywhere]">
              {s.patient_name} <PendingMark id={s.id} />
            </h2>
            <span
              className={classNames(
                'chip shrink-0',
                s.status === 'done'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : s.status === 'cancelled'
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : s.status === 'postponed'
                      ? 'border-amber-300 bg-amber-100 text-amber-800'
                      : 'border-slate-200 bg-white/70 text-slate-600',
              )}
            >
              {SCAN_STATUS_LABELS[s.status]}
            </span>
          </div>
          <p className="text-sm text-slate-600 [overflow-wrap:anywhere]">
            {[s.hospital?.name, what, surgeon].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="min-w-0 rounded-xl bg-white/70 px-2.5 py-1.5">
          <dt className="text-xs text-slate-500">CT</dt>
          <dd className="font-semibold text-slate-800">
            {s.ct_date ? formatDate(s.ct_date) : <span className="font-normal text-slate-500">לא נקבע</span>}
          </dd>
          {(s.ct_time || ctRel) && (
            <dd className={classNames('text-xs', ctUrgent ? 'font-medium text-red-600' : 'text-slate-500')}>
              {[s.ct_time ? formatTime(s.ct_time) : '', ctRel].filter(Boolean).join(' · ')}
            </dd>
          )}
        </div>
        <div className="min-w-0 rounded-xl bg-white/70 px-2.5 py-1.5">
          <dt className="text-xs text-slate-500">ניתוח</dt>
          <dd className="font-semibold text-slate-800">
            {s.surgery_date ? formatDate(s.surgery_date) : <span className="font-normal text-slate-500">לא נקבע</span>}
          </dd>
        </div>
      </dl>

      {hasAlerts && (
        <div className="mt-2 flex flex-wrap gap-1">
          {noCtSoon && <span className="chip border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700">ניתוח השבוע — אין CT</span>}
          {!noCtSoon && noDiskSoon && <span className="chip border-orange-200 bg-orange-100 text-orange-700">ניתוח השבוע — אין דיסק</span>}
          {missing.map((m) => (
            <span key={m} className="chip border-sky-200 bg-sky-100 text-sky-700">{m}</span>
          ))}
          {s.rescan && (
            <span
              className={classNames(
                'chip',
                s.rescan_done
                  ? 'border-slate-200 bg-slate-50 text-slate-500'
                  : 'border-rose-200 bg-rose-100 text-rose-700',
              )}
            >
              {s.rescan_done
                ? 'סריקה חוזרת בוצעה'
                : `סריקה חוזרת ${s.rescan_date ? formatDate(s.rescan_date) : '— ללא תאריך'}`}
              {s.rescan_reason && !s.rescan_done ? ` · ${s.rescan_reason}` : ''}
            </span>
          )}
        </div>
      )}

      {(s.status === 'postponed' || s.status === 'cancelled') && s.notes && (
        <p dir="auto" className="mt-2 text-xs font-medium text-slate-700 [overflow-wrap:anywhere]">
          {s.notes.split('\n')[0]}
        </p>
      )}
      {implants && <p className="mt-2 text-xs text-slate-500 [overflow-wrap:anywhere]">{implants}</p>}
      {s.anaesthesia_note && <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">מרדים: {s.anaesthesia_note}</p>}

      <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-slate-200/70 pt-2" role="group" aria-label={`התקדמות של ${s.patient_name}`}>
        {TOGGLES.map(({ key, label }) => {
          const on = !!s[key]
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onPatch({ [key]: !on })}
              className={classNames(
                'flex min-h-[38px] items-center justify-center gap-1 rounded-xl border px-1 text-[13px] font-medium transition',
                on
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300',
              )}
            >
              {on && <Check size={14} aria-hidden="true" />}
              {label}
            </button>
          )
        })}
      </div>

      <div className="mt-1.5 flex items-center gap-0.5">
        {s.patient_phone && (
          <a href={`tel:${s.patient_phone}`} className={ICON_BTN} aria-label={`התקשר ל${s.patient_name}`} title="התקשר">
            <Phone size={18} />
          </a>
        )}
        <button type="button" className={ICON_BTN} disabled={!hasEvents} onClick={onInvite} aria-label={`זימון Outlook: ${s.patient_name}`} title="זימון Outlook">
          <CalendarPlus size={18} />
        </button>
        <button type="button" className={ICON_BTN} onClick={onStatus} aria-label={`נדחה, בוטל או בוצע: ${s.patient_name}`} title="נדחה / בוטל / בוצע">
          <CalendarClock size={18} />
        </button>
        <button type="button" className={ICON_BTN} onClick={onEdit} aria-label={`עריכת ${s.patient_name}`} title="עריכה">
          <Pencil size={18} />
        </button>
        <ConfirmButton
          className={classNames(ICON_BTN, 'ms-auto text-red-500 hover:text-red-600')}
          label={`מחיקת ${s.patient_name}`}
          onConfirm={onDelete}
        >
          <Trash2 size={18} />
        </ConfirmButton>
      </div>
    </article>
  )
}
