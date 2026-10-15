import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A form state that is kept on the device while it is being written, so that leaving the screen (a call, a trip,
 * a closed tab) does not lose it. `restored` tells that the initial value came from a saved draft.
 */
export function useDraft<T>(key: string, initial: T, enabled: boolean): { value: T; setValue: React.Dispatch<React.SetStateAction<T>>; restored: boolean; clear: () => void } {
  const full = `ami.draft.${key}`
  const restoredRef = useRef(false)
  const [value, setValue] = useState<T>(() => {
    if (!enabled) return initial
    try {
      const raw = localStorage.getItem(full)
      if (raw) {
        restoredRef.current = true
        return { ...initial, ...(JSON.parse(raw) as T) }
      }
    } catch {
      /* no storage */
    }
    return initial
  })
  const [restored, setRestored] = useState(restoredRef.current)

  const start = useRef(JSON.stringify(initial))
  useEffect(() => {
    if (!enabled) return
    try {
      const json = JSON.stringify(value)
      if (json === start.current) localStorage.removeItem(full)
      else localStorage.setItem(full, json)
    } catch {
      /* no storage */
    }
  }, [value, enabled, full])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(full)
    } catch {
      /* no storage */
    }
    setRestored(false)
  }, [full])

  return { value, setValue, restored, clear }
}
