import { useEffect, useState } from 'react'
import { todayISO } from './utils'

/** today's local date that follows the clock: a screen left open overnight (a phone on a table) moves to the new day by itself */
export function useToday(): string {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const sync = () => setToday(todayISO())
    const schedule = () => {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
      // (setTimeout is clamped to ~24 days; a day is far below that)
      timer = setTimeout(() => {
        sync()
        schedule()
      }, next.getTime() - now.getTime())
    }
    schedule()
    // a phone that slept comes back after the timer was frozen
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return today
}
