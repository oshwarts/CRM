import { MEETING_STATUS_LABELS } from '../lib/types'
import { classNames } from '../lib/utils'

const STATUS_TONE: Record<string, string> = {
  scheduled: 'border-brand-200 bg-brand-50 text-brand-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  needs_followup: 'border-amber-200 bg-amber-50 text-amber-700',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
}

/** the status of a meeting as a small coloured label (colour is never the only signal: the text says it too) */
export function MeetingStatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <span className={classNames('chip !px-2 !py-0.5', STATUS_TONE[status] ?? STATUS_TONE.cancelled, className)}>
      {MEETING_STATUS_LABELS[status] ?? status}
    </span>
  )
}
