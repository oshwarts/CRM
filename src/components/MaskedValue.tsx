import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** a sensitive number (an ID) shows only its last digits until the person asks to see it: a screen shared or glanced at does not give it away */
export function MaskedValue({ value, visible = 3 }: { value: string; visible?: number }) {
  const [shown, setShown] = useState(false)
  if (!value) return <span className="text-slate-300">—</span>
  const masked = value.length <= visible ? '•'.repeat(value.length) : `${'•'.repeat(value.length - visible)}${value.slice(-visible)}`
  return (
    <span className="inline-flex items-center gap-1.5">
      <span dir="ltr">{shown ? value : masked}</span>
      <button type="button" className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label={shown ? 'הסתר' : 'הצג'} title={shown ? 'הסתר' : 'הצג'} onClick={() => setShown((v) => !v)}>
        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  )
}
