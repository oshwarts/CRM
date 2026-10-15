import { useSyncExternalStore } from 'react'

// A tiny notification store: a short message at the bottom of the screen ("saved", "deleted — undo", an error).

export type Toast = { id: number; text: string; kind: 'ok' | 'error' | 'info'; action?: { label: string; run: () => void }; ms: number }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast(text: string, opts: { kind?: Toast['kind']; action?: Toast['action']; ms?: number } = {}) {
  const t: Toast = { id: nextId++, text, kind: opts.kind ?? 'ok', action: opts.action, ms: opts.ms ?? (opts.action ? 6000 : opts.kind === 'error' ? 6000 : 2200) }
  // the same message twice in a row is shown once
  toasts = [...toasts.filter((x) => x.text !== text), t].slice(-3)
  emit()
  setTimeout(() => dismissToast(t.id), t.ms)
  return t.id
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => toasts,
  )
}
