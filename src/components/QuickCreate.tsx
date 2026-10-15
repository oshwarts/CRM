import { useState } from 'react'
import { CalendarDays, CheckSquare, ScanLine, Stethoscope, X } from 'lucide-react'
import { MeetingFormModal } from './MeetingFormModal'
import { TaskFormModal } from './TaskFormModal'
import { ScanFormModal } from './ScanFormModal'
import { DoctorFormModal } from './DoctorFormModal'

type Kind = 'meeting' | 'task' | 'scan' | 'doctor'

const OPTIONS: { kind: Kind; label: string; hint: string; icon: React.ReactNode }[] = [
  { kind: 'meeting', label: 'פגישה', hint: 'קביעה או תיעוד של פגישה', icon: <CalendarDays size={22} /> },
  { kind: 'task', label: 'משימה', hint: 'דבר שצריך לעשות', icon: <CheckSquare size={22} /> },
  { kind: 'scan', label: 'סריקה', hint: 'מטופל חדש ל-MAKO', icon: <ScanLine size={22} /> },
  { kind: 'doctor', label: 'רופא', hint: 'כרטיס רופא חדש', icon: <Stethoscope size={22} /> },
]

/** the "+" menu: create the common things from any page */
export function QuickCreate({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null)
  if (kind === 'meeting') return <MeetingFormModal open onClose={onClose} />
  if (kind === 'task') return <TaskFormModal onClose={onClose} />
  if (kind === 'scan') return <ScanFormModal onClose={onClose} />
  if (kind === 'doctor') return <DoctorFormModal open onClose={onClose} />
  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label="חדש">
      <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-800">מה להוסיף?</h2>
          <button className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="סגור">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {OPTIONS.map((o) => (
            <button key={o.kind} className="flex flex-col items-start gap-2 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 text-right transition hover:border-brand-300 hover:bg-brand-50" onClick={() => setKind(o.kind)}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">{o.icon}</span>
              <span>
                <span className="block font-semibold text-brand-800">{o.label}</span>
                <span className="block text-xs text-slate-500">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
