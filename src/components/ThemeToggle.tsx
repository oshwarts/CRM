import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeMode, type ThemeMode } from '../lib/theme'
import { classNames } from '../lib/utils'

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'system', label: 'לפי המכשיר', Icon: Monitor },
  { mode: 'light', label: 'בהיר', Icon: Sun },
  { mode: 'dark', label: 'כהה', Icon: Moon },
]

/** light / dark / follow the device */
export function ThemeToggle() {
  const [mode, setMode] = useThemeMode()
  return (
    <div className="mb-1 flex items-center gap-1 rounded-full bg-slate-100 p-1" role="group" aria-label="מראה המסך">
      {OPTIONS.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={classNames(
            'flex flex-1 items-center justify-center rounded-full py-1.5',
            mode === m ? 'bg-white text-brand-700 shadow-card' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}
