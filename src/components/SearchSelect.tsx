import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { normalizeHe } from '../lib/contactMatch'
import { classNames } from '../lib/utils'

export type Option = { id: string; label: string; hint?: string }

/** a select with a search box: type a few letters of a name instead of scrolling a long list */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'בחר…',
  clearLabel = 'ללא',
}: {
  options: Option[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
  clearLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.id === value)

  const shown = useMemo(() => {
    const words = normalizeHe(q).split(' ').filter(Boolean)
    if (!words.length) return options.slice(0, 80)
    return options.filter((o) => words.every((w) => normalizeHe(`${o.label} ${o.hint ?? ''}`).includes(w))).slice(0, 80)
  }, [q, options])

  useEffect(() => setActive(0), [q, open])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (id: string | null) => {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="input flex items-center justify-between gap-2 text-right"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span dir="auto" className={classNames('min-w-0 flex-1 truncate', selected ? 'text-slate-800' : 'text-slate-400')}>
          {selected ? selected.label : placeholder}
        </span>
        {selected ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="נקה בחירה"
            className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100"
            onClick={(e) => {
              e.stopPropagation()
              pick(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && pick(null)}
          >
            <X size={14} />
          </span>
        ) : (
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          <input
            autoFocus
            className="w-full border-b border-slate-100 px-3 py-2 text-sm outline-none"
            dir="auto"
            placeholder="הקלד לחיפוש…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, shown.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (shown[active]) pick(shown[active].id)
              } else if (e.key === 'Escape') setOpen(false)
            }}
          />
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            <li>
              <button type="button" className="w-full px-3 py-1.5 text-right text-sm text-slate-500 hover:bg-slate-50" onClick={() => pick(null)}>
                {clearLabel}
              </button>
            </li>
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">לא נמצא</li>}
            {shown.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  className={classNames('flex w-full items-center justify-between gap-2 px-3 py-1.5 text-right text-sm', i === active ? 'bg-brand-50' : 'hover:bg-slate-50')}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.id)}
                >
                  <span dir="auto" className="min-w-0 truncate">
                    {o.label}
                    {o.hint && <span className="mr-2 text-xs text-slate-500">{o.hint}</span>}
                  </span>
                  {o.id === value && <Check size={14} className="shrink-0 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
