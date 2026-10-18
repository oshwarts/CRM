// A signed-in device that nobody touches for hours signs itself out: a phone left on a desk in a hospital should not keep patient
// details open. A minute before, a question appears ("still here?"); any touch keeps the person in. Nothing is signed out while
// there are changes waiting to be sent (they would be lost).
import { useEffect, useRef, useState } from 'react'
import { outboxSize } from './outbox'

const KEY = 'ami.lastActive'
export const IDLE_HOURS = 4
const WARN_MS = 60_000

const read = () => {
  try {
    return Number(localStorage.getItem(KEY)) || Date.now()
  } catch {
    return Date.now()
  }
}
const write = () => {
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* no storage */
  }
}

/** `onExpire` signs out; `warning` is the number of seconds left while the question is shown (0 = no question) */
export function useIdleLogout(enabled: boolean, onExpire: () => void): { warning: number; stay: () => void } {
  const [warning, setWarning] = useState(0)
  const expire = useRef(onExpire)
  expire.current = onExpire

  useEffect(() => {
    if (!enabled) return
    write()
    let last = 0
    const touch = () => {
      const now = Date.now()
      if (now - last < 5_000) return // writing on every mouse move is wasteful
      last = now
      write()
      setWarning(0)
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))

    const limit = IDLE_HOURS * 3_600_000
    const tick = window.setInterval(() => {
      const idle = Date.now() - read()
      if (outboxSize() > 0) return
      if (idle >= limit + WARN_MS) expire.current()
      else if (idle >= limit) setWarning(Math.max(1, Math.ceil((limit + WARN_MS - idle) / 1000)))
    }, 5_000)
    const onVisible = () => document.visibilityState === 'visible' && Date.now() - read() >= limit + WARN_MS && outboxSize() === 0 && expire.current()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])

  return { warning, stay: () => (write(), setWarning(0)) }
}
