// Light / dark / follow-the-device. The choice is kept on the device; the class "dark" on <html> switches the colours.
import { useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
const KEY = 'ami.theme'

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(mode: ThemeMode = getThemeMode()) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0a1424' : '#00326d')
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode)
  useEffect(() => {
    applyTheme(mode)
    if (mode !== 'system') return
    // following the device: react when it switches (evening, a setting)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [mode])
  return [
    mode,
    (m) => {
      try {
        localStorage.setItem(KEY, m)
      } catch {
        /* not kept */
      }
      setMode(m)
    },
  ]
}

export type TextSize = 'compact' | 'regular' | 'large'
const SIZE_KEY = 'ami.size'

export function applyTextSize(size: TextSize) {
  if (size === 'regular') document.documentElement.removeAttribute('data-size')
  else document.documentElement.setAttribute('data-size', size)
}

export function useTextSize(): [TextSize, (v: TextSize) => void] {
  const [size, setSize] = useState<TextSize>(() => {
    try {
      const v = localStorage.getItem(SIZE_KEY)
      return v === 'compact' || v === 'large' ? v : 'regular'
    } catch {
      return 'regular'
    }
  })
  return [
    size,
    (v) => {
      try {
        localStorage.setItem(SIZE_KEY, v)
      } catch {
        /* not kept */
      }
      applyTextSize(v)
      setSize(v)
    },
  ]
}
