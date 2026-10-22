import { Link } from 'react-router-dom'
import { CalendarPlus, ExternalLink, Pencil } from 'lucide-react'
import { downloadIcs, type CalEvent } from '../../lib/scanExport'
import { formatDate } from '../../lib/utils'
import { Modal } from '../ui'
import { KINDS, type Item } from './shared'

/** a calendar item as an appointment file Outlook opens (a single event, the user's own timezone) */
export function itemToCalEvent(it: Item): CalEvent {
  return { uid: it.id, title: `${KINDS[it.kind].label}: ${it.title}`, date: it.date, time: it.time || null, durationMin: it.durationMin ?? 60, location: it.sub, description: it.sub }
}

export function addToOutlook(it: Item) {
  downloadIcs([itemToCalEvent(it)], `${KINDS[it.kind].label}-${it.date}.ics`)
}

/** what is behind an event on the calendar: its details, a way to open it and "add to Outlook" */
export function EventSheet({ item, onClose, onEdit }: { item: Item; onClose: () => void; onEdit: (item: Item) => void }) {
  const opensForm = !!item.surgery || !!item.task
  return (
    <Modal open onClose={onClose} title={`${KINDS[item.kind].label}${item.muted ? ' · בוצע' : ''}`} size="md">
      <div className="space-y-3">
        <div>
          <p dir="auto" className="text-base font-semibold text-slate-800 [overflow-wrap:anywhere]">
            {item.title}
          </p>
          <p className="text-sm text-slate-600">
            {formatDate(item.date)}
            {item.time ? (
              <>
                {' · '}
                <span dir="ltr">{item.time}</span>
              </>
            ) : (
              ' · כל היום'
            )}
          </p>
          {item.sub && (
            <p dir="auto" className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
              {item.sub}
            </p>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {opensForm ? (
            <button type="button" className="btn-primary" onClick={() => onEdit(item)}>
              <Pencil size={16} aria-hidden /> עריכה
            </button>
          ) : (
            <Link to={item.to} className="btn-primary" onClick={onClose}>
              <ExternalLink size={16} aria-hidden /> פתיחה
            </Link>
          )}
          <button type="button" className="btn-secondary" onClick={() => addToOutlook(item)}>
            <CalendarPlus size={16} aria-hidden /> הוסף ל-Outlook
          </button>
        </div>
        <p className="text-xs text-slate-500">הקובץ נפתח ב-Outlook כפגישה חדשה ביומן שלך. שום דבר לא נשלח לאף אחד.</p>
      </div>
    </Modal>
  )
}
