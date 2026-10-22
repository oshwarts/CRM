import { useState } from 'react'
import { CalendarDays, CheckSquare, Scissors } from 'lucide-react'
import { Field, Modal } from '../ui'

/** a press on a free hour: what to start there (a meeting, a task or a surgery), with the day and the hour that can still be changed */
export function SlotMenu({ date: d0, time: t0, onPick, onClose }: { date: string; time: string; onPick: (kind: 'meeting' | 'task' | 'surgery', date: string, time: string) => void; onClose: () => void }) {
  const [date, setDate] = useState(d0)
  const [time, setTime] = useState(t0)
  const big = 'flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50'
  return (
    <Modal open onClose={onClose} title="אירוע חדש ביומן" size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="תאריך">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="שעה">
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={big} onClick={() => onPick('meeting', date, time)}>
            <CalendarDays size={20} aria-hidden /> פגישה
          </button>
          <button type="button" className={big} onClick={() => onPick('task', date, time)}>
            <CheckSquare size={20} aria-hidden /> משימה
          </button>
          <button type="button" className={big} onClick={() => onPick('surgery', date, time)}>
            <Scissors size={20} aria-hidden /> ניתוח
          </button>
        </div>
        <p className="text-xs text-slate-500">משימה נקבעת לתאריך (בלי שעה). פגישה וניתוח נשמרים עם השעה.</p>
      </div>
    </Modal>
  )
}
