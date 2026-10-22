import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertTriangle, Cloud, CloudOff, Clock } from 'lucide-react'
import { useOnline } from '../lib/offline'
import { useOutbox } from '../lib/outbox'
import { OutboxPanel } from './OutboxPanel'

/** connection state + changes waiting to be sent; tapping it opens the list of waiting changes */
export function OfflineBanner() {
  const online = useOnline()
  const { ops, pending, conflicts, failed, draining } = useOutbox()
  const wasOffline = useRef(false)
  const box = useRef<HTMLDivElement>(null)
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
  const visible = !online || back || waiting > 0

  // the banner floats over the bottom of the page: --offline-h tells the page (its bottom padding) and the toasts how much room it takes
  useLayoutEffect(() => {
    const el = box.current
    const root = document.documentElement
    if (!visible || !el) return
    const set = () => root.style.setProperty('--offline-h', `${el.offsetHeight + 8}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--offline-h')
    }
  }, [visible])

  // the last waiting change was sent while the list is open: the list stays and says so, until it is closed
  if (!visible) return open ? <OutboxPanel onClose={() => setOpen(false)} /> : null

  // white text on these colours is at least 4.5:1
  const tone = needsAction > 0 && online ? 'bg-[#c7403a]' : online && !back ? 'bg-[#a35f00]' : online ? 'bg-[#15803d]' : 'bg-[#a35f00]'
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
  const cls = `flex w-full items-start gap-2 rounded-xl px-3 py-2 text-right text-sm text-white shadow-lg ${tone}`
  const inner = (
    <>
      <Icon size={18} aria-hidden className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </>
  )

  return (
    <>
      {/* the live region announces the state; the list of waiting changes opens only when there is one to show */}
      <div ref={box} role="status" className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 mx-auto max-w-md md:bottom-4">
        {waiting > 0 ? (
          <button type="button" onClick={() => setOpen(true)} className={cls}>
            {inner}
          </button>
        ) : (
          <div className={cls}>{inner}</div>
        )}
      </div>
      {open && <OutboxPanel onClose={() => setOpen(false)} />}
    </>
  )
}
