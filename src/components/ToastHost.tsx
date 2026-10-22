import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { dismissToast, useToasts } from '../lib/toast'
import { classNames } from '../lib/utils'

/** the notifications of the app: above the phone's tab bar (and above the connection banner when it is shown), centred on the desktop */
export function ToastHost() {
  const toasts = useToasts()
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem+var(--offline-h,0px))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-[calc(1.5rem+var(--offline-h,0px))]" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.kind === 'error' ? AlertCircle : t.kind === 'info' ? Info : CheckCircle2
        return (
          <div
            key={t.id}
            className={classNames(
              'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-3xl py-1.5 pe-1.5 ps-4 text-sm font-medium text-white shadow-pop',
              t.kind === 'error' ? 'bg-[#c7403a]' : t.kind === 'info' ? 'bg-[#0d4090]' : 'bg-[#00326d]',
            )}
          >
            <Icon size={17} className="shrink-0" />
            <span dir="auto" className="min-w-0 py-1">
              {t.text}
            </span>
            {t.action && (
              <button
                className="shrink-0 rounded-full bg-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/30"
                onClick={() => {
                  t.action!.run()
                  dismissToast(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full opacity-80 hover:bg-white/15 hover:opacity-100" onClick={() => dismissToast(t.id)} aria-label="סגור">
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
