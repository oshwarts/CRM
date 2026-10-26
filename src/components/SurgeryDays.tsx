import { CalendarDays } from 'lucide-react'
import { useSetHospitalCommercial } from '../lib/hospitalStats'
import { formatDays } from '../lib/clinics'
import { DayPicker } from './DayPicker'

/** the days of the week on which the hospital operates: tap the days, it is saved at once (shown on the info and the surgeries tabs) */
export function SurgeryDays({ hospitalId, days }: { hospitalId: string; days: number[] | null | undefined }) {
  const save = useSetHospitalCommercial()
  const value = days ?? []
  return (
    <section className="card space-y-2 p-3.5 sm:p-4" aria-label="ימי ניתוחים">
      <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
        <CalendarDays size={16} aria-hidden /> ימי ניתוחים בבית החולים
      </h2>
      <DayPicker label="ימי ניתוחים" value={value} onChange={(d) => save.mutate({ id: hospitalId, surgery_days: d })} />
      <p className="text-xs text-slate-500" aria-live="polite">
        {value.length > 0 ? `מנתחים בימים ${formatDays(value)}` : 'לא נבחרו ימים — לחץ על היום כדי לסמן'}
        {save.isError ? ' · השמירה נכשלה, נסה שוב' : ''}
      </p>
    </section>
  )
}
