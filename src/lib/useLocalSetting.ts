import { useCallback, useEffect, useRef, useState } from 'react'

// every place that shows a setting (the menu, the page that edits it, another tab) hears when it changes
const listeners = new Map<string, Set<() => void>>()
const notify = (key: string) => listeners.get(key)?.forEach((f) => f())

/** like useState, but kept on this device for good (preferences such as menu favourites) and shared by every component that uses the same key */
export function useLocalSetting<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const full = `ami.pref.${key}`
  const initialRef = useRef(initial)
  const read = useCallback((): T => {
    try {
      const raw = localStorage.getItem(full)
      if (raw === null) return initialRef.current
      const saved = JSON.parse(raw) as unknown
      // a value of another kind (an old or damaged entry) must not reach the code that expects the initial's kind
      return typeof saved === typeof initialRef.current && Array.isArray(saved) === Array.isArray(initialRef.current) && saved !== null ? (saved as T) : initialRef.current
    } catch {
      return initialRef.current
    }
  }, [full])
  const [value, setValue] = useState<T>(read)

  useEffect(() => {
    const update = () => setValue(read())
    const set = listeners.get(full) ?? new Set<() => void>()
    set.add(update)
    listeners.set(full, set)
    // another tab changed it
    const onStorage = (e: StorageEvent) => e.key === full && update()
    window.addEventListener('storage', onStorage)
    update() // something may have changed between the first render and now
    return () => {
      set.delete(update)
      window.removeEventListener('storage', onStorage)
    }
  }, [full, read])

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(read()) : v
      try {
        localStorage.setItem(full, JSON.stringify(next))
      } catch {
        /* not kept */
      }
      setValue(next)
      notify(full) // the other components that show this setting
    },
    [full, read],
  )
  return [value, set]
}
