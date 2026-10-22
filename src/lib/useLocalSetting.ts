import { useCallback, useState } from 'react'

/** like useState, but kept on this device for good (preferences such as menu favourites) */
export function useLocalSetting<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const full = `ami.pref.${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(full)
      if (raw === null) return initial
      const saved = JSON.parse(raw) as unknown
      // a value of another kind (an old or damaged entry) must not reach the code that expects the initial's kind
      return typeof saved === typeof initial && Array.isArray(saved) === Array.isArray(initial) && saved !== null ? (saved as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        try {
          localStorage.setItem(full, JSON.stringify(next))
        } catch {
          /* not kept */
        }
        return next
      })
    },
    [full],
  )
  return [value, set]
}
