import { useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'

const THRESHOLD = 90

/**
 * Touch screens: drag a row sideways to complete it (a green "done" shows underneath, let go past the line).
 * Vertical scrolling is untouched; the checkbox stays for mouse and keyboard.
 */
export function SwipeToComplete({ onComplete, disabled, children }: { onComplete: () => void; disabled?: boolean; children: ReactNode }) {
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null)
  if (disabled) return <>{children}</>
  const armed = Math.abs(dx) >= THRESHOLD
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ touchAction: 'pan-y' }}>
      <div aria-hidden className={`absolute inset-0 flex items-center justify-between px-5 text-sm font-semibold text-white transition-colors ${armed ? 'bg-[#1d9a6c]' : 'bg-[#1d9a6c]/60'} ${dx === 0 ? 'invisible' : ''}`}>
        <span className="flex items-center gap-1.5">
          <Check size={18} /> בוצע
        </span>
        <span className="flex items-center gap-1.5">
          בוצע <Check size={18} />
        </span>
      </div>
      <div
        className="relative"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? undefined : 'transform .2s ease-out' }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          start.current = { x: t.clientX, y: t.clientY, active: false }
        }}
        onTouchMove={(e) => {
          const s = start.current
          if (!s) return
          const t = e.touches[0]
          const mx = t.clientX - s.x
          const my = t.clientY - s.y
          if (!s.active && Math.abs(mx) > 14 && Math.abs(mx) > Math.abs(my) * 1.5) s.active = true
          if (s.active) setDx(mx)
        }}
        onTouchEnd={() => {
          const fire = start.current?.active && Math.abs(dx) >= THRESHOLD
          start.current = null
          setDx(0)
          if (fire) onComplete()
        }}
        onTouchCancel={() => {
          start.current = null
          setDx(0)
        }}
      >
        {children}
      </div>
    </div>
  )
}
