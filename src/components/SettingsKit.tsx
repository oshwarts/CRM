import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * A settings block that opens and closes: one bar with the title and the number of items, so that a tab with several
 * blocks is a short list on the phone instead of a long scroll. The content is only mounted while it is open.
 */
export function Section({
  title,
  count,
  hint,
  defaultOpen = false,
  children,
  className,
}: {
  title: string
  count?: number
  /** one line under the title while closed */
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <section className={classNames('card overflow-hidden', className)}>
      <h2 className="m-0">
        <button
          type="button"
          className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-right"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-slate-800">{title}</span>
            {hint && !open && <span className="block text-xs font-normal text-slate-500">{hint}</span>}
          </span>
          {count !== undefined && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{count}</span>}
          <ChevronDown size={18} aria-hidden className={classNames('shrink-0 text-slate-500 transition', open && 'rotate-180')} />
        </button>
      </h2>
      {open && (
        <div id={id} className="border-t border-slate-100 px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </section>
  )
}

/** a search box for a long list inside settings */
export function ListSearch({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search size={18} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input type="search" enterKeyHint="search" className="input !pr-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/** the line shown when a list has nothing in it */
export function EmptyRow({ children }: { children: ReactNode }) {
  return <li className="py-5 text-center text-sm text-slate-500">{children}</li>
}
