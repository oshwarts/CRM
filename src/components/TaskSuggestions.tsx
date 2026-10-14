import { useMemo } from 'react'
import { Building2, CalendarDays, Flame, Repeat, Sparkles, Stethoscope } from 'lucide-react'
import { useDoctors, useHospitals } from '../lib/api'
import { guessTask, type TaskGuess } from '../lib/taskParse'

const ICON = { date: CalendarDays, priority: Flame, repeat: Repeat, doctor: Stethoscope, hospital: Building2 }

/** what was understood from a written / dictated task, with a button to fill the fields */
export function useTaskGuess(text: string): TaskGuess | null {
  const doctors = useDoctors()
  const hospitals = useHospitals()
  return useMemo(() => {
    if (text.trim().length < 3) return null
    const g = guessTask(text, { doctors: doctors.data ?? [], hospitals: hospitals.data ?? [] })
    return g.found.length ? g : null
  }, [text, doctors.data, hospitals.data])
}

export function TaskSuggestions({ guess, onApply }: { guess: TaskGuess | null; onApply: (g: TaskGuess) => void }) {
  if (!guess) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
      <Sparkles size={14} className="shrink-0 text-violet-500" />
      <span className="text-violet-700">זיהיתי:</span>
      {guess.found.map((f, i) => {
        const Icon = ICON[f.kind]
        return (
          <span key={i} className="chip border-violet-200 bg-white !px-2 !py-0 text-violet-700">
            <Icon size={12} /> {f.label}
          </span>
        )
      })}
      <button type="button" className="mr-auto rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700" onClick={() => onApply(guess)}>
        החל על הטופס
      </button>
    </div>
  )
}
