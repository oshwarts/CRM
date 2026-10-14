import { useState } from 'react'
import { useCanDelete } from '../lib/permissions'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  Copy,
  Mail,
  MapPin,
  Pencil,
  Square,
  Trash2,
  User,
} from 'lucide-react'
import {
  useDeleteMeeting,
  useDoctorMeetings,
  useMeeting,
  useToggleMeetingTask,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { composeMail } from '../lib/mail'
import { meetingMailText } from '../lib/meetingMail'
import { copyText } from '../lib/scanExport'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { ConfirmButton, EmptyState, ErrorState, Spinner } from '../components/ui'
import { MEETING_STATUS_LABELS } from '../lib/types'
import { classNames, formatDate, formatTime, isOverdue } from '../lib/utils'

export default function MeetingView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const meeting = useMeeting(id)
  const toggleTask = useToggleMeetingTask()
  const deleteMeeting = useDeleteMeeting()
  const canDelete = useCanDelete()
  const [editing, setEditing] = useState(false)
  const [pickedDoctor, setPickedDoctor] = useState<string | null>(null)
  const { profile } = useAuth()
  const [mailOpen, setMailOpen] = useState(params.get('mail') === '1')
  const [mailTo, setMailTo] = useState(() => {
    try {
      return localStorage.getItem('ami.meeting.mailTo') ?? ''
    } catch {
      return ''
    }
  })
  const [mailNote, setMailNote] = useState('')

  const m = meeting.data
  const doctors = (m?.meeting_doctors ?? []).flatMap((x) => (x.doctor ? [x.doctor] : []))
  // the doctor whose history is shown: the one we came from, else the first participant
  const contextId = pickedDoctor ?? params.get('doctor') ?? doctors[0]?.id
  const contextDoctor = doctors.find((d) => d.id === contextId) ?? doctors[0]
  const history = useDoctorMeetings(contextDoctor?.id)
  const others = (history.data ?? []).filter((x) => x.id !== id)

  if (meeting.isLoading) return <Spinner />
  if (!m) return <ErrorState error={meeting.error ?? new Error('הפגישה לא נמצאה')} />

  const mail = meetingMailText(m, profile?.full_name ?? '')
  const links = composeMail(mailTo.trim(), mail.subject, mail.body)
  const rememberTo = () => {
    try {
      localStorage.setItem('ami.meeting.mailTo', mailTo.trim())
    } catch {
      // not critical
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/meetings" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
          <ArrowRight size={14} />
          לכל הפגישות
        </Link>
        <div className="flex items-center gap-1">
          <button className="btn-secondary" onClick={() => setMailOpen((o) => !o)}>
            <Mail size={16} />
            שלח סיכום במייל
          </button>
          <button className="btn-ghost !px-2" onClick={() => setEditing(true)} aria-label="עריכה">
            <Pencil size={16} />
          </button>
          {canDelete(m.created_by) && (
            <ConfirmButton
              className="btn-ghost !px-2 text-red-500"
              onConfirm={() => deleteMeeting.mutate(m.id, { onSuccess: () => navigate('/meetings') })}
            >
              <Trash2 size={16} />
            </ConfirmButton>
          )}
        </div>
      </div>

      {mailOpen && (
        <div className="card space-y-3 border-brand-200 p-4">
          <p className="text-sm font-semibold text-slate-800">שליחת סיכום הפגישה במייל</p>
          <label className="block">
            <span className="label">אל (כתובת מייל, אפשר כמה מופרדות בפסיק)</span>
            <input
              dir="ltr"
              className="input text-right"
              placeholder="name@company.co.il"
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <a
              className="btn-primary"
              href={links.outlook.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={async () => {
                rememberTo()
                if (links.outlook.mode === 'copied') {
                  await copyText(mail.body)
                  setMailNote('הסיכום ארוך — הועתק ללוח. הדבק אותו בטיוטה (Ctrl+V).')
                } else setMailNote('נפתחה טיוטה ב-Outlook — בדוק ולחץ "שלח". שום דבר לא נשלח לפני כן.')
              }}
            >
              <Mail size={16} />
              פתח ב-Outlook
            </a>
            <a
              className="btn-secondary"
              href={links.mailto.url}
              onClick={async () => {
                rememberTo()
                if (links.mailto.mode === 'copied') {
                  await copyText(mail.body)
                  setMailNote('הסיכום ארוך — הועתק ללוח. הדבק אותו בטיוטה (Ctrl+V).')
                } else setMailNote('אם לא נפתחה טיוטה, אין אפליקציית מייל במכשיר — נסה "פתח ב-Outlook".')
              }}
            >
              <Mail size={16} />
              אפליקציית מייל
            </a>
            <button
              className="btn-secondary"
              onClick={async () => setMailNote((await copyText(`${mail.subject}

${mail.body}`)) ? 'הסיכום הועתק.' : 'ההעתקה נכשלה.')}
            >
              <Copy size={16} />
              העתק טקסט
            </button>
          </div>
          <p className="text-xs text-slate-400">הכפתורים פותחים טיוטה בלבד — המייל נשלח רק אחרי שתבדוק ותלחץ "שלח".</p>
          {mailNote && <p className="text-xs text-slate-500">{mailNote}</p>}
        </div>
      )}

      <div className="card space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{m.subject || 'פגישה'}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              {m.meeting_date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={14} />
                  {formatDate(m.meeting_date)}
                  {m.meeting_time ? ` · ${formatTime(m.meeting_time)}` : ''}
                </span>
              )}
              {m.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} />
                  {m.location}
                </span>
              )}
              {m.responsible_agent?.full_name && (
                <span className="inline-flex items-center gap-1">
                  <User size={14} />
                  {m.responsible_agent.full_name}
                </span>
              )}
            </div>
          </div>
          <span className="chip border-slate-200 bg-slate-50 text-slate-500">
            {MEETING_STATUS_LABELS[m.status]}
          </span>
        </div>

        {m.hospital && (
          <p className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
            <Building2 size={14} />
            {m.hospital.name}
          </p>
        )}

        {(doctors.length > 0 || m.meeting_contacts.length > 0 || m.meeting_agents.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {doctors.map((d) => (
              <Link
                key={d.id}
                to={`/doctors/${d.id}`}
                className="chip border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
              >
                {d.title} {d.name}
              </Link>
            ))}
            {m.meeting_agents.map(
              (a) =>
                a.agent && (
                  <span key={a.agent.id} className="chip border-slate-300 bg-slate-100 text-slate-700">
                    {a.agent.full_name}
                    {a.agent.role === 'admin' ? ' (מנהל)' : ''}
                  </span>
                ),
            )}
            {m.meeting_contacts.map(
              (c) =>
                c.contact && (
                  <span
                    key={c.contact.id}
                    className="chip border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    {c.contact.name}
                    {c.contact.role ? ` · ${c.contact.role}` : ''}
                  </span>
                ),
            )}
          </div>
        )}

        {m.extra_participants && (
          <p className="text-sm text-slate-500">
            <span className="font-medium">משתתפים נוספים: </span>
            {m.extra_participants}
          </p>
        )}

        {m.summary ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{m.summary}</p>
        ) : (
          <p className="text-sm text-slate-400">לא נרשם סיכום.</p>
        )}

        {m.decisions && (
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
            <span className="font-medium">החלטות: </span>
            {m.decisions}
          </p>
        )}

        {m.competitor_notes && (
          <p className="whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-slate-700">
            <span className="font-medium">פעילות מתחרים: </span>
            {m.competitor_notes}
          </p>
        )}

        {m.meeting_tasks.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">משימות להמשך</p>
            <ul className="space-y-1.5">
              {m.meeting_tasks.map((t) => (
                <li key={t.id}>
                  <button
                    className="flex items-start gap-2 text-right text-sm text-slate-700"
                    onClick={() => toggleTask.mutate(t)}
                  >
                    {t.is_done ? (
                      <CheckSquare size={16} className="mt-0.5 shrink-0 text-brand-500" />
                    ) : (
                      <Square size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    )}
                    <span className={t.is_done ? 'text-slate-400 line-through' : ''}>
                      {t.description}
                      {t.due_date ? ` (${formatDate(t.due_date)})` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {m.next_followup_date && (
          <p
            className={classNames(
              'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm',
              isOverdue(m.next_followup_date) && m.status !== 'done'
                ? 'bg-red-50 text-red-600'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            <Clock size={14} />
            מעקב הבא: {formatDate(m.next_followup_date)}
          </p>
        )}
      </div>

      {contextDoctor && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-800">
              פגישות נוספות עם {contextDoctor.title} {contextDoctor.name}
            </h2>
            <Link to={`/doctors/${contextDoctor.id}`} className="text-sm font-medium text-brand-600 hover:underline">
              לכרטיס הרופא →
            </Link>
          </div>

          {doctors.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setPickedDoctor(d.id)}
                  className={classNames(
                    'chip',
                    d.id === contextDoctor.id
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                >
                  {d.title} {d.name}
                </button>
              ))}
            </div>
          )}

          {history.isLoading && <Spinner />}
          {history.data && others.length === 0 && (
            <EmptyState title="אין פגישות נוספות עם רופא זה" />
          )}
          <div className="space-y-2">
            {others.map((x) => (
              <Link
                key={x.id}
                to={`/meetings/${x.id}?doctor=${contextDoctor.id}`}
                className="card block p-3 hover:border-brand-200"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-800">{x.subject || 'פגישה'}</p>
                  <span className="shrink-0 text-sm text-slate-400">{formatDate(x.meeting_date)}</span>
                </div>
                {x.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{x.summary}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <Link to="/meetings" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowRight size={14} />
        לכל הפגישות
      </Link>

      {editing && <MeetingFormModal open meeting={m} onClose={() => setEditing(false)} />}
    </div>
  )
}
