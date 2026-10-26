import { useState } from 'react'
import { CalendarDays, CheckSquare, MapPinned, Navigation, Scissors, UserPlus } from 'lucide-react'
import type { Hospital } from '../lib/types'
import { classNames } from '../lib/utils'
import { MeetingFormModal } from './MeetingFormModal'
import { TaskFormModal } from './TaskFormModal'
import { PlannedSurgeryModal } from './PlannedSurgeryModal'
import { HospitalContactModal } from './HospitalContactModal'

type NavHospital = Pick<Hospital, 'name' | 'city' | 'address' | 'lat' | 'lng'>

/** Waze and Google Maps links — by coordinates when the hospital has them, otherwise by name and city */
export function hospitalNavLinks(h: NavHospital) {
  const hasCoords = h.lat != null && h.lng != null
  // the city is left out when the name already says it ("אסותא אשדוד")
  const place = [h.name, h.address, h.city && !h.name.includes(h.city) ? h.city : ''].filter(Boolean).join(' ')
  return {
    waze: hasCoords
      ? `https://waze.com/ul?ll=${h.lat},${h.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${hasCoords ? `${h.lat},${h.lng}` : encodeURIComponent(place)}`,
  }
}

const tile =
  'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100'

/** Waze / Google Maps as two small buttons (the hospital page header) */
export function NavButtons({ hospital }: { hospital: NavHospital }) {
  const nav = hospitalNavLinks(hospital)
  const pill = 'inline-flex min-h-[40px] items-center gap-1 rounded-full border border-brand-200 bg-white px-3 text-sm font-medium text-brand-700 hover:bg-brand-50'
  return (
    <div className="flex flex-wrap gap-2">
      <a href={nav.waze} target="_blank" rel="noreferrer" className={pill}>
        <Navigation size={15} /> Waze
      </a>
      <a href={nav.google} target="_blank" rel="noreferrer" className={pill}>
        <MapPinned size={15} /> גוגל מפות
      </a>
    </div>
  )
}

/**
 * One-tap actions for a hospital: navigate (Waze / Google Maps), and a new meeting, task, planned surgery or
 * contact with the hospital already filled in.
 */
export function HospitalActions({
  hospital,
  compact,
  header,
  className,
}: {
  hospital: NavHospital & { id: string }
  /** narrow side panel: always three in a row */
  compact?: boolean
  /** the hospital page: only the four "new …" actions in one row (navigation sits next to the address) */
  header?: boolean
  className?: string
}) {
  const [open, setOpen] = useState<null | 'meeting' | 'task' | 'surgery' | 'contact'>(null)
  const nav = hospitalNavLinks(hospital)
  const close = () => setOpen(null)

  return (
    <>
      {header ? (
        <div className={classNames('grid grid-cols-4 gap-2', className)}>
          <button className={classNames(tile, '!bg-brand-600 !text-white hover:!bg-brand-700')} onClick={() => setOpen('meeting')}>
            <CalendarDays size={18} /> פגישה
          </button>
          <button className={tile} onClick={() => setOpen('task')}>
            <CheckSquare size={18} /> משימה
          </button>
          <button className={tile} onClick={() => setOpen('surgery')}>
            <Scissors size={18} /> ניתוח
          </button>
          <button className={tile} onClick={() => setOpen('contact')}>
            <UserPlus size={18} /> איש קשר
          </button>
        </div>
      ) : (
        <div className={classNames('grid grid-cols-3 gap-2', !compact && 'sm:grid-cols-6', className)}>
          <a href={nav.waze} target="_blank" rel="noreferrer" className={tile}>
            <Navigation size={18} /> Waze
          </a>
          <a href={nav.google} target="_blank" rel="noreferrer" className={tile}>
            <MapPinned size={18} /> גוגל מפות
          </a>
          <button className={tile} onClick={() => setOpen('meeting')}>
            <CalendarDays size={18} /> פגישה
          </button>
          <button className={tile} onClick={() => setOpen('task')}>
            <CheckSquare size={18} /> משימה
          </button>
          <button className={tile} onClick={() => setOpen('surgery')}>
            <Scissors size={18} /> ניתוח
          </button>
          <button className={tile} onClick={() => setOpen('contact')}>
            <UserPlus size={18} /> איש קשר
          </button>
        </div>
      )}

      {open === 'meeting' && <MeetingFormModal open onClose={close} defaultHospitalId={hospital.id} />}
      {open === 'task' && <TaskFormModal defaults={{ hospital_id: hospital.id }} onClose={close} />}
      {open === 'surgery' && <PlannedSurgeryModal hospitalId={hospital.id} onClose={close} />}
      {open === 'contact' && <HospitalContactModal hospitalId={hospital.id} hospitalName={hospital.name} onClose={close} />}
    </>
  )
}
