import type { ReactNode } from 'react'
import { classNames } from '../lib/utils'

/** the save / cancel row of an inline form: on the phone it stays above the bottom bar while a long form scrolls */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={classNames(
        'sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-3 flex justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none',
        className,
      )}
    >
      {children}
    </div>
  )
}
