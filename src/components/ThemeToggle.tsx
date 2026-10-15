import { Monitor, Moon, Sun } from 'lucide-react'
import { useTextSize, useThemeMode, type TextSize, type ThemeMode } from '../lib/theme'
import { classNames } from '../lib/utils'

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'system', label: 'לפי המכשיר', Icon: Monitor },
  { mode: 'light', label: 'בהיר', Icon: Sun },
  { mode: 'dark', label: 'כהה', Icon: Moon },
]

const SIZES: { size: TextSize; label: string; cls: string }[] = [
  { size: 'compact', label: 'תצוגה קומפקטית', cls: 'text-[11px]' },
  { size: 'regular', label: 'גודל רגיל', cls: 'text-sm' },
  { size: 'large', label: 'תצוגה גדולה', cls: 'text-lg' },
]

/** light / dark / follow the device, and the size of everything */
export function ThemeToggle() {
  const [mode, setMode] = useThemeMode()
  const [size, setSize] = useTextSize()
  return (
    <>
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
    <div className="mb-1 flex items-center gap-1 rounded-full bg-slate-100 p-1" role="group" aria-label="גודל התצוגה">
      {SIZES.map(({ size: z, label, cls }) => (
        <button
          key={z}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={size === z}
          onClick={() => setSize(z)}
          className={classNames('flex flex-1 items-center justify-center rounded-full py-1 font-semibold leading-6', cls, size === z ? 'bg-white text-brand-700 shadow-card' : 'text-slate-500 hover:text-slate-700')}
        >
          א
        </button>
      ))}
    </div>
    </>
  )
}
