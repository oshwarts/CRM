import { CalendarPlus, Pencil, Phone, Trash2 } from 'lucide-react'
import { ConfirmButton } from './ui'
import { rowFlags } from '../lib/scanAlerts'
import { implantSummary } from '../lib/scanExport'
import {
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { classNames, formatDate, formatTime } from '../lib/utils'

type Patch = Partial<
  Pick<PatientScanRow, 'scanned' | 'disk_collected' | 'plan_ready' | 'uploaded'>
>

const TOGGLES: { key: keyof Patch; label: string }[] = [
  { key: 'scanned', label: 'נסרק' },
  { key: 'disk_collected', label: 'דיסק' },
  { key: 'plan_ready', label: 'תוכנית' },
  { key: 'uploaded', label: 'הועלה' },
]

export function ScanCard({
  s,
  selected,
  onToggle,
  onEdit,
  onInvite,
  onDelete,
  onPatch,
}: {
  s: PatientScanRow
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onInvite: () => void
  onDelete: () => void
  onPatch: (p: Patch) => void
}) {
  const { overdueRow, soon, noCtSoon, noDiskSoon, missing, rescanKind, hasEvents } = rowFlags(s)
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

  return (
    <div className={classNames('rounded-2xl border p-3 shadow-sm', tone, selected && 'ring-2 ring-brand-400')}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0"
          checked={selected}
          onChange={onToggle}
          aria-label="בחר"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800">{s.patient_name}</p>
            <span className="chip shrink-0 border-slate-200 bg-white/70 text-slate-600">
              {SCAN_STATUS_LABELS[s.status]}
            </span>
          </div>
          <p className="text-sm text-slate-500">{s.hospital?.name}</p>
          <p className="text-sm text-slate-600">
            {[SCAN_PROCEDURE_LABELS[s.procedure_type], s.side].filter(Boolean).join(' ')}
            {s.surgeon ? ` · ${s.surgeon.title} ${s.surgeon.name}` : ''}
          </p>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <div>
          <dt className="text-xs text-slate-400">ניתוח</dt>
          <dd className="text-slate-700">{formatDate(s.surgery_date) || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">CT</dt>
          <dd className="text-slate-700">
            {s.ct_date ? `${formatDate(s.ct_date)}${s.ct_time ? ` ${formatTime(s.ct_time)}` : ''}` : '—'}
          </dd>
        </div>
      </dl>

      {(noCtSoon || noDiskSoon || missing.length > 0 || s.rescan) && (
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

      {implantSummary(s) && <p className="mt-2 text-xs text-slate-500">{implantSummary(s)}</p>}
      {s.anaesthesia_note && <p className="mt-1 text-xs text-slate-500">מרדים: {s.anaesthesia_note}</p>}

      <div className="mt-3 grid grid-cols-4 gap-1 border-t border-slate-200/70 pt-2">
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="flex flex-col items-center gap-1 py-1 text-xs text-slate-600">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={!!s[key]}
              onChange={(e) => onPatch({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1">
        {s.patient_phone && (
          <a href={`tel:${s.patient_phone}`} className="btn-ghost !px-3" aria-label="התקשר">
            <Phone size={18} />
          </a>
        )}
        <button className="btn-ghost !px-3 disabled:opacity-30" disabled={!hasEvents} onClick={onInvite} aria-label="זימון Outlook">
          <CalendarPlus size={18} />
        </button>
        <button className="btn-ghost !px-3" onClick={onEdit} aria-label="עריכה">
          <Pencil size={18} />
        </button>
        <ConfirmButton className="btn-ghost !px-3 text-red-500" onConfirm={onDelete}>
          <Trash2 size={18} />
        </ConfirmButton>
      </div>
    </div>
  )
}
