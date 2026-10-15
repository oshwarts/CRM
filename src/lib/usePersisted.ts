import { useCallback, useState } from 'react'

/** like useState, but the value survives going to another page and coming back (kept for this browser tab) */
export function usePersisted<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const full = `ami.ui.${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(full)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        try {
          sessionStorage.setItem(full, JSON.stringify(next))
        } catch {
          /* storage unavailable: the value just is not kept */
        }
        return next
      })
    },
    [full],
  )
  return [value, set]
}
