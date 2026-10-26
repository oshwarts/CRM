import { X } from 'lucide-react'
import {
  Children,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { classNames } from '../lib/utils'

/* ---------------- Modal ---------------- */

/** the dialogs that are open now, the last one is on top (only it answers Escape and Tab) */
const openModals: object[] = []
/** the page's own overflow, saved when the first dialog opens and given back when the last one closes (dialogs may close in any order) */
let overflowBefore = ''

/**
 * What every dialog needs: the page behind does not scroll, keyboard focus moves into the box (unless a field inside already took it),
 * Tab stays inside, Escape closes the top-most dialog, and focus returns to where it was. Used by Modal and by the shell's own dialogs.
 */
export function useDialog(open: boolean, onClose: () => void, box: RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // what had the focus before the dialog opened — noted while rendering, i.e. BEFORE a child's autoFocus runs (in the effect it would
  // already be a field inside the dialog, and closing could not give the focus back to the button that opened it)
  const openerRef = useRef<HTMLElement | null>(null)
  if (open && openerRef.current === null) openerRef.current = document.activeElement as HTMLElement | null
  if (!open) openerRef.current = null

  useEffect(() => {
    if (!open) return
    const token = {}
    if (openModals.length === 0) {
      overflowBefore = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openModals.push(token)
    const before = openerRef.current
    if (box.current && !box.current.contains(document.activeElement)) box.current.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== token) return
      if (e.key === 'Escape') {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !box.current) return
      const items = [...box.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.getClientRects().length > 0)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === box.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !box.current.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openModals.splice(openModals.indexOf(token), 1)
      if (openModals.length === 0) document.body.style.overflow = overflowBefore
      if (before && document.contains(before)) before.focus({ preventScroll: true })
    }
  }, [open, box])
}

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
  const titleId = useId()
  const box = useRef<HTMLDivElement>(null)
  useDialog(open, onClose, box)

  if (!open) return null
  const maxW = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]

  return (
    // starts below the developer-mode strip (--banner is set by the Layout while the developer acts as another user)
    <div className="fixed inset-x-0 bottom-0 top-[var(--banner,0px)] z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 sm:p-8">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={classNames(
          'card w-full animate-[fadeIn_.12s_ease-out] outline-none max-sm:min-h-full max-sm:rounded-none',
          maxW,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-5 py-4 max-sm:rounded-none">
          <h2 id={titleId} className="text-lg font-semibold text-slate-800">{title}</h2>
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
  const ctx = useContext(TabsCtx)
  const ref = useRef<HTMLDivElement>(null)
  // on the phone the tabs are one row that scrolls sideways; the open tab is brought into view
  useEffect(() => {
    const box = ref.current
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (box && el && box.scrollWidth > box.clientWidth) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [ctx?.value])
  // a fade at the end of the row tells that more tabs wait beyond the edge (the phone shows about four of nine)
  const [more, setMore] = useState(false)
  const measure = () => {
    const box = ref.current
    if (!box) return
    const rtl = getComputedStyle(box).direction === 'rtl'
    const away = rtl ? -box.scrollLeft : box.scrollLeft // how far the row is scrolled from its start
    setMore(box.scrollWidth - box.clientWidth - away > 4)
  }
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ctx?.value, children])
  return (
    <div className="relative mb-4">
    <div
      ref={ref}
      role="tablist"
      onScroll={measure}
      className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      // arrow keys move between the tabs (in a right-to-left page the right arrow is the previous one), Home / End jump to the ends
      onKeyDown={(e) => {
        const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')]
        const at = tabs.indexOf(document.activeElement as HTMLElement)
        if (at < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
        const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
        const step = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (at + step + tabs.length) % tabs.length
        e.preventDefault()
        tabs[next].focus()
        tabs[next].click()
      }}
    >
      {children}
    </div>
    {more && <span aria-hidden className="pointer-events-none absolute inset-y-0 end-0 w-10 rounded-e-xl bg-gradient-to-l from-slate-100 to-transparent sm:hidden rtl:bg-gradient-to-r" />}
    </div>
  )
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!
  const active = ctx.value === id
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(id)}
      className={classNames(
        'min-h-[40px] flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
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
  return <div role="tabpanel" className="space-y-4">{children}</div>
}

/* ---------------- Misc ---------------- */

/** while data loads: grey placeholder lines in the shape of a list (or a spinner with a text when a label is given) */
export function Spinner({ label }: { label?: string }) {
  if (label === undefined)
    return (
      <div className="animate-pulse space-y-3 p-4" role="status" aria-label="טוען">
        <div className="h-5 w-2/5 rounded-lg bg-slate-200/80" />
        <div className="h-4 w-4/5 rounded-lg bg-slate-200/60" />
        <div className="h-4 w-3/5 rounded-lg bg-slate-200/60" />
        <div className="h-24 w-full rounded-2xl bg-slate-200/50" />
      </div>
    )
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-slate-500">
      <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white/70 p-10 text-center">
      <p className="text-lg font-medium text-brand-800">{title}</p>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error }: { error: unknown }) {
  const real =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''
  // a dropped connection is not something to show as "TypeError: Failed to fetch"
  const offline = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(real)
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{offline ? 'אין חיבור לשרת כרגע. בדוק את הרשת ונסה שוב — מה שכבר נטען נשמר במכשיר.' : 'שגיאה בטעינת הנתונים. אם זה חוזר, רענן את האפליקציה כדי לקבל את הגרסה האחרונה.'}</p>
      {real && !offline && (
        <p dir="auto" className="text-xs text-red-500">
          {real}
        </p>
      )}
      <button className="btn-secondary" onClick={() => window.location.reload()}>
        רענן את האפליקציה
      </button>
    </div>
  )
}

export function Field({
  label,
  children,
  className,
  error,
}: {
  label: string
  children: ReactNode
  className?: string
  /** shown under the field, which also gets a red edge */
  error?: string
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  // the visible label names its control: one control gets aria-labelledby, several make the block a labelled group
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const controls = root.querySelectorAll<HTMLInputElement>('input:not([type=hidden]),select,textarea')
    if (controls.length === 0) return
    const c = controls[0]
    if (controls.length === 1 && c.type !== 'checkbox' && c.type !== 'radio') {
      if (!c.hasAttribute('aria-label') && !c.hasAttribute('aria-labelledby') && !(c.labels && c.labels.length)) c.setAttribute('aria-labelledby', id)
      // the message under the field is read with it
      if (error) {
        c.setAttribute('aria-invalid', 'true')
        c.setAttribute('aria-describedby', `${id}-error`)
      } else if (c.getAttribute('aria-describedby') === `${id}-error`) {
        c.removeAttribute('aria-invalid')
        c.removeAttribute('aria-describedby')
      }
    } else if (!root.hasAttribute('role')) {
      root.setAttribute('role', 'group')
      root.setAttribute('aria-labelledby', id)
    }
  })
  return (
    <div ref={ref} className={classNames(className, error && '[&_.input]:border-red-500 [&_.input]:ring-2 [&_.input]:ring-red-200')}>
      <span id={id} className="label">{label}</span>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
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
            aria-pressed={on}
            onClick={() => onToggle(o.id)}
            className={classNames(
              'chip max-sm:!min-h-10',
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
  label,
}: {
  onConfirm: () => void
  children: ReactNode
  message?: string
  className?: string
  /** the name for screen readers; by default "מחיקה" when the button holds only an icon */
  label?: string
}) {
  const iconOnly = Children.toArray(children).every((c) => typeof c !== 'string' && typeof c !== 'number')
  return (
    <button
      type="button"
      className={className}
      aria-label={label ?? (iconOnly ? 'מחיקה' : undefined)}
      title={label ?? (iconOnly ? 'מחיקה' : undefined)}
      onClick={() => {
        if (window.confirm(message)) onConfirm()
      }}
    >
      {children}
    </button>
  )
}
