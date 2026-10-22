import { Plus } from 'lucide-react'

/** "add" that stays on the screen while a long list scrolls: above the bottom bar on the phone, in the corner on a wide screen */
export function AddFab({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] end-4 z-30 inline-flex min-h-[52px] items-center gap-2 rounded-full bg-brand-600 px-5 text-base font-semibold text-white shadow-lg transition hover:bg-brand-700 active:scale-95 disabled:opacity-50 md:bottom-6 md:end-6"
    >
      <Plus size={20} aria-hidden />
      <span className="max-sm:sr-only">{label}</span>
    </button>
  )
}
