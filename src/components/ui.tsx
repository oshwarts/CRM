import { X } from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react'
import { classNames } from '../lib/utils'

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const maxW = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div
        className={classNames(
          'card w-full animate-[fadeIn_.12s_ease-out]',
          maxW,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button className="btn-ghost !px-2" onClick={onClose} aria-label="סגור">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/* ---------------- Tabs ---------------- */

const TabsCtx = createContext<{
  value: string
  setValue: (v: string) => void
} | null>(null)

export function Tabs({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <TabsCtx.Provider value={{ value, setValue: onChange }}>
      {children}
    </TabsCtx.Provider>
  )
}

export function TabList({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {children}
    </div>
  )
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!
  const active = ctx.value === id
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(id)}
      className={classNames(
        'flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
        active
          ? 'bg-white text-brand-600 shadow-sm'
          : 'text-slate-500 hover:text-slate-700',
      )}
    >
      {children}
    </button>
  )
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!
  if (ctx.value !== id) return null
  return <div className="space-y-4">{children}</div>
}

/* ---------------- Misc ---------------- */

export function Spinner({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      {label}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="text-sm text-slate-400">{hint}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error }: { error: unknown }) {
  const msg =
    error instanceof Error ? error.message : 'אירעה שגיאה בטעינת הנתונים'
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {msg}
    </div>
  )
}

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
    </div>
  )
}

export function MultiSelectChips<T extends { id: string }>({
  options,
  selected,
  onToggle,
  labelOf,
}: {
  options: T[]
  selected: string[]
  onToggle: (id: string) => void
  labelOf: (o: T) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={classNames(
              'chip',
              on
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
            )}
          >
            {labelOf(o)}
          </button>
        )
      })}
      {options.length === 0 && (
        <span className="text-sm text-slate-400">אין פריטים — הוסף בהגדרות</span>
      )}
    </div>
  )
}

export function ConfirmButton({
  onConfirm,
  children,
  message = 'למחוק? הפעולה אינה הפיכה.',
  className = 'btn-danger',
}: {
  onConfirm: () => void
  children: ReactNode
  message?: string
  className?: string
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.confirm(message)) onConfirm()
      }}
    >
      {children}
    </button>
  )
}
