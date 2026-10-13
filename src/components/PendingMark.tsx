import { AlertTriangle, Clock } from 'lucide-react'
import { usePendingRecords } from '../lib/outbox'

/** a small marker next to a record whose change has not reached the server yet */
export function PendingMark({ id }: { id: string }) {
  const pending = usePendingRecords()
  const state = pending.get(id)
  if (!state) return null
  return state === 'pending' ? (
    <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-xs text-amber-700" title="השינוי נשמר בטלפון ויישלח כשיהיה חיבור">
      <Clock size={11} /> ממתין לשליחה
    </span>
  ) : (
    <span className="chip border-red-200 bg-red-50 !px-2 !py-0 text-xs text-red-600" title="נדרש טיפול — לחץ על הפס בתחתית המסך">
      <AlertTriangle size={11} /> דורש טיפול
    </span>
  )
}
