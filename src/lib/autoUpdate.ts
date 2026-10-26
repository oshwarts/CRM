import { useEffect } from 'react'
import { newVersionAvailable } from './offline'
import { outboxSize } from './outbox'
import { toast } from './toast'

const LAST_RELOAD = 'ami.autoReloadAt'
const MIN_GAP_MS = 60_000 // a deployment that is still spreading must not put the app in a reload loop
const CHECK_EVERY_MS = 5 * 60_000

/** may the app reload by itself now? Never while changes wait to be sent, a dialog is open or the person is typing. */
export function canReloadNow(s: { outbox: number; dialogOpen: boolean; typing: boolean; lastReloadAt: number; now: number }): boolean {
  return s.outbox === 0 && !s.dialogOpen && !s.typing && s.now - s.lastReloadAt > MIN_GAP_MS
}

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/**
 * An installed app that comes back from the background is not reloaded by the phone, so it kept running the old version until it was
 * closed twice. Here the app looks for a newer build each time it comes to the front (and every few minutes while open) and loads it:
 * at once when that is safe, otherwise with a "refresh" button on a message.
 */
export function useAutoUpdate() {
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let checking = false
    async function check() {
      if (checking || document.visibilityState !== 'visible' || !navigator.onLine) return
      checking = true
      try {
        if (!(await newVersionAvailable())) return
        const last = Number(sessionStorage.getItem(LAST_RELOAD) ?? 0)
        if (canReloadNow({ outbox: outboxSize(), dialogOpen: !!document.querySelector('[role="dialog"]'), typing: isTyping(), lastReloadAt: last, now: Date.now() })) {
          sessionStorage.setItem(LAST_RELOAD, String(Date.now()))
          window.location.reload()
        } else {
          toast('יש גרסה חדשה של האפליקציה', { action: { label: 'רענן', run: () => window.location.reload() }, ms: 20000 })
        }
      } catch {
        /* a failed check is tried again at the next one */
      } finally {
        checking = false
      }
    }
    const onVisible = () => void check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    const timer = window.setInterval(onVisible, CHECK_EVERY_MS)
    const first = window.setTimeout(onVisible, 3000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
      window.clearInterval(timer)
      window.clearTimeout(first)
    }
  }, [])
}
