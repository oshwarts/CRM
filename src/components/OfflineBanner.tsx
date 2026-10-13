import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Cloud, CloudOff, Clock } from 'lucide-react'
import { useOnline } from '../lib/offline'
import { useOutbox } from '../lib/outbox'
import { OutboxPanel } from './OutboxPanel'

/** connection state + changes waiting to be sent; tapping it opens the list of waiting changes */
export function OfflineBanner() {
  const online = useOnline()
  const { ops, pending, conflicts, failed, draining } = useOutbox()
  const wasOffline = useRef(false)
  const [back, setBack] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      setBack(false)
      return
    }
    if (wasOffline.current) {
      wasOffline.current = false
      setBack(true)
      const t = setTimeout(() => setBack(false), 4000)
      return () => clearTimeout(t)
    }
  }, [online])

  const needsAction = conflicts + failed
  const waiting = ops.length
  if (online && !back && waiting === 0) return null

  const tone = needsAction > 0 && online ? 'bg-red-600' : online && !back ? 'bg-amber-500' : online ? 'bg-green-600' : 'bg-amber-500'
  const text = !online
    ? `אין חיבור לרשת. משימות, סריקות, ספירת מתכלים ופגישות יישמרו וישלחו כשהחיבור יחזור.${waiting ? ` ממתינים: ${waiting}.` : ''}`
    : needsAction > 0
      ? `${needsAction} שינויים דורשים טיפול — לחץ לפרטים.`
      : draining
        ? `שולח ${pending} שינויים…`
        : pending > 0
          ? `${pending} שינויים ממתינים לשליחה — לחץ לפרטים.`
          : 'החיבור חזר — הנתונים מתעדכנים.'
  const Icon = needsAction > 0 ? AlertTriangle : !online ? CloudOff : pending > 0 || draining ? Clock : Cloud

  return (
    <>
      <button
        type="button"
        role="status"
        onClick={() => setOpen(true)}
        className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 mx-auto flex max-w-md items-start gap-2 rounded-xl px-3 py-2 text-right text-sm text-white shadow-lg md:bottom-4 ${tone}`}
      >
        <Icon size={18} className="mt-0.5 shrink-0" />
        <span>{text}</span>
      </button>
      {open && <OutboxPanel onClose={() => setOpen(false)} />}
    </>
  )
}
