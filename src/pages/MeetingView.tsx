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
  Printer,
  Square,
  Trash2,
  User,
} from 'lucide-react'
import {
  useCompetitorIntel,
  useDeleteMeeting,
  useDoctorMeetings,
  useMeeting,
  useToggleMeetingTask,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { composeMail, normalizeRecipients } from '../lib/mail'
import { meetingMailText } from '../lib/meetingMail'
import { copyText } from '../lib/scanExport'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { Bidi, MeetingStatusChip } from '../components/MeetingBits'
import { PendingMark } from '../components/PendingMark'
import { ConfirmButton, ErrorState, Spinner } from '../components/ui'
import { classNames, formatDate, formatTime, isOverdue, todayISO } from '../lib/utils'

/** one meeting; a different id starts the screen afresh (open form, mail box, chosen doctor do not carry over) */
export default function MeetingView() {
  const { id } = useParams()
  return <MeetingScreen key={id} />
}

function MeetingScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const meeting = useMeeting(id)
  const intel = useCompetitorIntel()
  // the record of this meeting on the competitors side (the competitor it is about)
  const competitorRecord = (intel.data ?? []).find((i) => i.meeting_id === id)
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
  if (!m) {
    // a failed read with nothing cached is an error; a read that answered "no such meeting" is a not-found page
    if (meeting.error) return <ErrorState error={meeting.error} />
    return (
      <div className="card mx-auto max-w-md space-y-3 p-6 text-center">
        <h1 className="text-lg font-semibold text-brand-800">הפגישה לא נמצאה</h1>
        <p className="text-sm text-slate-600">ייתכן שהיא נמחקה, או שהקישור שגוי.</p>
        <Link to="/meetings" className="btn-primary inline-flex">
          <ArrowRight size={16} />
          לכל הפגישות
        </Link>
      </div>
    )
  }

  const recipients = normalizeRecipients(mailTo)
  const mail = meetingMailText(m, profile?.full_name ?? '')
  const links = composeMail(recipients.list, mail.subject, mail.body)
  const rememberTo = () => {
    try {
      localStorage.setItem('ami.meeting.mailTo', recipients.list)
    } catch {
      // not critical
    }
  }
  // the date has passed and nobody closed the meeting
  const neverClosed = m.status === 'scheduled' && !!m.meeting_date && m.meeting_date < todayISO()

  const weekday = m.meeting_date
    ? new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(new Date(`${m.meeting_date}T12:00:00`))
    : ''
  const followupLate = !!m.next_followup_date && isOverdue(m.next_followup_date) && m.status !== 'done' && m.status !== 'cancelled'
  const doneTasks = m.meeting_tasks.filter((t) => t.is_done).length
  const hasPeople = doctors.length > 0 || m.meeting_contacts.length > 0 || m.meeting_agents.length > 0

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/meetings" className="inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <ArrowRight size={14} />
          לכל הפגישות
        </Link>
        <div className="flex items-center">
          <button className="btn-secondary !px-3" onClick={() => setMailOpen((o) => !o)} aria-expanded={mailOpen}>
            <Mail size={16} />
            שלח במייל
          </button>
          <button className="btn-ghost hidden !px-2 sm:inline-flex" onClick={() => window.print()} aria-label="הדפסה" title="הדפסה">
            <Printer size={16} />
          </button>
          <button className="btn-ghost !px-2" onClick={() => setEditing(true)} aria-label="עריכה" title="עריכה">
            <Pencil size={16} />
          </button>
          {canDelete(m.created_by) && (
            <ConfirmButton
              className="btn-ghost !px-2 text-red-600"
              message={`למחוק את הפגישה "${m.subject || 'פגישה'}"?${m.meeting_tasks.length ? ` גם ${m.meeting_tasks.length} המשימות שלה יימחקו.` : ''} הפעולה אינה הפיכה.`}
              onConfirm={() => deleteMeeting.mutate(m.id, { onSuccess: () => navigate('/meetings') })}
            >
              <Trash2 size={16} />
            </ConfirmButton>
          )}
        </div>
      </div>

      {mailOpen && (
        <div className="card space-y-3 border-brand-200 p-3 sm:p-4">
          <p className="text-sm font-semibold text-slate-800">שליחת סיכום הפגישה במייל</p>
          <label className="block">
            <span className="label">אל (כתובת מייל, אפשר כמה מופרדות בפסיק)</span>
            <input
              dir="ltr"
              type="email"
              multiple
              inputMode="email"
              autoComplete="email"
              className="input text-right"
              placeholder="name@company.co.il"
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
            />
            {recipients.invalid.length > 0 && (
              <span className="mt-1 block text-xs text-amber-700" dir="auto">
                לא נראית ככתובת מייל: {recipients.invalid.join(', ')}
              </span>
            )}
          </label>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <a
              className="btn-primary"
              href={links.outlook.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={async () => {
                rememberTo()
                if (links.outlook.mode === 'copied') {
                  const ok = await copyText(mail.body)
                  setMailNote(ok ? 'הסיכום ארוך — הועתק ללוח. הדבק אותו בטיוטה (Ctrl+V).' : 'הסיכום ארוך וההעתקה נכשלה — לחץ "העתק טקסט" והדבק בטיוטה.')
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
                  const ok = await copyText(mail.body)
                  setMailNote(ok ? 'הסיכום ארוך — הועתק ללוח. הדבק אותו בטיוטה (Ctrl+V).' : 'הסיכום ארוך וההעתקה נכשלה — לחץ "העתק טקסט" והדבק בטיוטה.')
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
          <p className="text-xs text-slate-600">הכפתורים פותחים טיוטה בלבד — המייל נשלח רק אחרי שתבדוק ותלחץ "שלח".</p>
          {mailNote && (
            <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-slate-700">
              {mailNote}
            </p>
          )}
        </div>
      )}

      <div id="meeting-print" className="card space-y-4 p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 break-words text-lg font-semibold leading-snug text-brand-800 sm:text-2xl"><Bidi text={m.subject || 'פגישה'} /></h1>
            <span className="mt-1 flex shrink-0 flex-col items-end gap-1">
              <MeetingStatusChip status={m.status} />
              <PendingMark id={m.id} />
            </span>
          </div>
          {neverClosed && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
              <span>מועד הפגישה עבר והיא עדיין מסומנת כמתוכננת.</span>
              <button className="font-medium text-brand-700 underline" onClick={() => setEditing(true)}>
                עדכון סטטוס
              </button>
            </p>
          )}
          <div className="grid gap-x-6 gap-y-1.5 text-sm text-slate-700 sm:grid-cols-2">
            {m.meeting_date && (
              <p className="flex items-start gap-2">
                <CalendarDays size={16} className="mt-0.5 shrink-0 text-slate-500" />
                <span>
                  {weekday} {formatDate(m.meeting_date)}
                  {m.meeting_time ? ` · ${formatTime(m.meeting_time)}` : ''}
                </span>
              </p>
            )}
            {m.hospital && (
              <p className="flex items-start gap-2 font-medium">
                <Building2 size={16} className="mt-0.5 shrink-0 text-slate-500" />
                <span className="min-w-0 break-words">{m.hospital.name}</span>
              </p>
            )}
            {m.location && (
              <p className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-slate-500" />
                <span className="min-w-0 break-words"><Bidi text={m.location} /></span>
              </p>
            )}
            {m.responsible_agent?.full_name && (
              <p className="flex items-start gap-2">
                <User size={16} className="mt-0.5 shrink-0 text-slate-500" />
                <span className="min-w-0 break-words">אחראי: {m.responsible_agent.full_name}</span>
              </p>
            )}
          </div>
          {m.next_followup_date && (
            <p
              className={classNames(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
                followupLate ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
              )}
            >
              <Clock size={14} />
              מעקב הבא: {formatDate(m.next_followup_date)}
              {followupLate ? ' (באיחור)' : ''}
            </p>
          )}
        </div>

        {(hasPeople || m.extra_participants) && (
          <section aria-label="משתתפים" className="space-y-2 border-t border-slate-100 pt-3">
            {hasPeople && (
              <div className="flex flex-wrap gap-1.5">
                {doctors.map((d) => (
                  <Link
                    key={d.id}
                    to={`/doctors/${d.id}`}
                    className="chip !min-h-[40px] border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
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
              <p className="break-words text-sm text-slate-600">
                <span className="font-medium">משתתפים נוספים: </span>
                <Bidi text={m.extra_participants} />
              </p>
            )}
          </section>
        )}

        <section aria-label="סיכום" className="border-t border-slate-100 pt-3">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">סיכום</h2>
          {m.summary ? (
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-800 sm:text-sm"><Bidi text={m.summary} /></p>
          ) : (
            <p className="text-sm text-slate-600">
              לא נרשם סיכום.{' '}
              <button className="font-medium text-brand-700 hover:underline" onClick={() => setEditing(true)}>
                הוספת סיכום
              </button>
            </p>
          )}
        </section>

        {m.decisions && (
          <section aria-label="החלטות" className="rounded-xl bg-slate-50 p-3">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">החלטות</h2>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-800 sm:text-sm"><Bidi text={m.decisions} /></p>
          </section>
        )}

        {m.competitor_notes && (
          <section aria-label="פעילות מתחרים" className="rounded-xl bg-amber-50 p-3">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">פעילות מתחרים</h2>
            {competitorRecord?.competitor_id && (
              <p className="mb-1 text-sm">
                <Link to={`/competitors/${competitorRecord.competitor_id}`} className="inline-flex min-h-[32px] items-center font-medium text-brand-700 hover:underline">
                  {competitorRecord.competitor || 'כרטיס המתחרה'} ← לכרטיס המתחרה
                </Link>
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-800 sm:text-sm"><Bidi text={m.competitor_notes} /></p>
          </section>
        )}

        {m.meeting_tasks.length > 0 && (
          <section aria-label="משימות להמשך" className="border-t border-slate-100 pt-3">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">
              משימות להמשך{' '}
              <span className="font-normal text-slate-600">
                ({doneTasks}/{m.meeting_tasks.length})
              </span>
            </h2>
            <ul>
              {m.meeting_tasks.map((t) => (
                <li key={t.id}>
                  <button
                    className="flex min-h-[40px] w-full items-start gap-2 rounded-lg px-1.5 py-2 text-right text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => toggleTask.mutate(t)}
                    aria-pressed={t.is_done}
                  >
                    {t.is_done ? (
                      <CheckSquare size={18} className="mt-px shrink-0 text-brand-500" />
                    ) : (
                      <Square size={18} className="mt-px shrink-0 text-slate-500" />
                    )}
                    <span className={classNames('min-w-0 break-words', t.is_done && 'text-slate-500 line-through')}>
                      <Bidi text={t.description} />
                      {t.due_date ? ` (${formatDate(t.due_date)})` : ''}
                    </span>
                    <PendingMark id={t.id} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {contextDoctor && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 className="min-w-0 break-words font-semibold text-brand-800">
              פגישות נוספות עם {contextDoctor.title} {contextDoctor.name}
            </h2>
            <Link to={`/doctors/${contextDoctor.id}`} className="inline-flex min-h-[40px] items-center text-sm font-medium text-brand-700 hover:underline">
              לכרטיס הרופא ←
            </Link>
          </div>

          {doctors.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="בחירת רופא להיסטוריה">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setPickedDoctor(d.id)}
                  aria-pressed={d.id === contextDoctor.id}
                  className={classNames(
                    'chip !min-h-[40px]',
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
            <p className="rounded-xl border border-dashed border-brand-200 bg-white/70 p-4 text-center text-sm text-slate-600">
              אין פגישות נוספות עם רופא זה
            </p>
          )}
          <div className="space-y-2">
            {others.map((x) => (
              <Link
                key={x.id}
                to={`/meetings/${x.id}?doctor=${contextDoctor.id}`}
                className="card block p-3 hover:border-brand-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 min-w-0 break-words font-medium text-slate-800"><Bidi text={x.subject || 'פגישה'} /></p>
                  <span className="shrink-0 text-sm tabular-nums text-slate-600">{x.meeting_date ? formatDate(x.meeting_date) : 'ללא תאריך'}</span>
                </div>
                {x.summary && (
                  <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600"><Bidi text={x.summary} /></p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {editing && <MeetingFormModal open meeting={m} onClose={() => setEditing(false)} />}
    </div>
  )
}
