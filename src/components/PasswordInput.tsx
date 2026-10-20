import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** a password field with a button that shows / hides what was typed (typing a password on a phone is error-prone) */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid,
  enterKeyHint,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  describedBy?: string
  invalid?: boolean
  enterKeyHint?: 'go' | 'next' | 'done'
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        dir="ltr"
        className="input !pl-12"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="absolute left-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={shown ? 'הסתר סיסמה' : 'הצג סיסמה'}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
