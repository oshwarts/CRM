import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, Info } from 'lucide-react'
import { useDoctorMeetings, usePatientScans } from '../lib/api'
import { useInvestigations } from '../lib/investigations'
import { useStageHistory } from '../lib/pipeline'
import { useLinkedTasks } from './LinkedTasks'
import { buildDigest, PERIOD_LABELS, type DigestPeriod } from '../lib/doctorDigest'
import { classNames, formatDate, todayISO } from '../lib/utils'

const PERIODS = Object.keys(PERIOD_LABELS) as DigestPeriod[]

const trend = (now: number, before: number) => (before === 0 && now === 0 ? '' : now > before ? ` (▲ מ-${before})` : now < before ? ` (▼ מ-${before})` : ` (כמו קודם)`)

/** "what is new with the doctor": the last month / quarter / half year / year, made from the data of the system */
export function DoctorDigest({ doctorId }: { doctorId: string }) {
  const [period, setPeriod] = useState<DigestPeriod>('quarter')
  const [open, setOpen] = useState(true)
  const meetings = useDoctorMeetings(doctorId)
  const scans = usePatientScans()
  const investigations = useInvestigations(doctorId)
  const stages = useStageHistory(doctorId)
  const tasks = useLinkedTasks({ doctorId })

  const digest = useMemo(
    () =>
      buildDigest(
        {
          doctorId,
          today: todayISO(),
          meetings: meetings.data ?? [],
          scans: scans.data ?? [],
          investigations: investigations.data ?? [],
          stages: stages.data ?? [],
          tasks: tasks.list,
        },
        period,
      ),
    [doctorId, period, meetings.data, scans.data, investigations.data, stages.data, tasks.list],
  )
  const loading = meetings.isLoading || scans.isLoading

  return (
    <section aria-label="מה חדש עם הרופא" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <button type="button" className="flex min-h-[44px] w-full items-center justify-between gap-2 text-start" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="font-semibold text-slate-800">מה חדש עם הרופא</span>
        <ChevronDown size={18} aria-hidden className={classNames('text-slate-500 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-3 pt-1">
          <div role="radiogroup" aria-label="תקופה" className="grid grid-cols-4 gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => setPeriod(p)}
                className={classNames('min-h-[40px] rounded-xl border px-1 text-sm font-medium', period === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {formatDate(digest.from)} – {formatDate(digest.to)}
          </p>

          {loading ? (
            <p className="text-sm text-slate-500">טוען…</p>
          ) : (
            <>
              {digest.alerts.length > 0 && (
                <ul className="space-y-1.5" aria-label="לתשומת לב">
                  {digest.alerts.map((a) => (
                    <li key={a.text} className={classNames('flex items-start gap-2 rounded-lg px-3 py-2 text-sm', a.level === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900')}>
                      {a.level === 'warn' ? <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" /> : <Info size={16} aria-hidden className="mt-0.5 shrink-0" />}
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="פגישות" value={`${digest.meetings.count}${trend(digest.meetings.count, digest.meetings.previous)}`} />
                <Stat label="ניתוחים שבוצעו" value={`${digest.surgeries.done}${trend(digest.surgeries.done, digest.surgeries.previous)}`} />
                <Stat label="נדחו / בוטלו" value={`${digest.surgeries.postponed + digest.surgeries.cancelled}`} />
                <Stat label="ניתוחים ב-30 ימים הקרובים" value={`${digest.surgeries.upcoming}`} />
              </div>

              <Block title={`פגישות (${digest.meetings.count})`}>
                {digest.meetings.recent.length === 0 ? (
                  <p className="text-sm text-slate-500">לא הייתה פגישה בתקופה{digest.meetings.lastDate ? `. האחרונה: ${formatDate(digest.meetings.lastDate)}` : ''}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {digest.meetings.recent.map((m) => (
                      <li key={m.id} className="text-sm">
                        <Link to={`/meetings/${m.id}`} className="inline-flex min-h-[32px] items-center gap-1 font-medium text-brand-700 hover:underline">
                          <span dir="auto">{m.subject}</span>
                          <span className="text-xs font-normal text-slate-500">{formatDate(m.date)}</span>
                        </Link>
                        {m.note && (
                          <p dir="auto" className="text-slate-600 [overflow-wrap:anywhere]">
                            {m.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {digest.meetings.competitorMentions > 0 && <p className="mt-1 text-xs text-slate-500">ב-{digest.meetings.competitorMentions} פגישות עלתה פעילות של מתחרים</p>}
              </Block>

              {(digest.investigations.list.length > 0 || digest.investigations.opened > 0) && (
                <Block title={`תחקירים (נפתחו ${digest.investigations.opened}, נסגרו ${digest.investigations.closed})`}>
                  <ul className="space-y-1 text-sm">
                    {digest.investigations.list.slice(0, 5).map((i) => (
                      <li key={i.id} dir="auto" className="[overflow-wrap:anywhere]">
                        <span className={classNames('me-1.5 rounded-full px-2 py-0.5 text-xs', i.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800')}>{i.status === 'open' ? 'פתוח' : 'נסגר'}</span>
                        {i.title}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {digest.stages.count > 0 && (
                <Block title="שינויי שלב">
                  <ul className="space-y-0.5 text-sm">
                    {digest.stages.list.map((s) => (
                      <li key={`${s.date}-${s.stage}`}>
                        {formatDate(s.date)}: {s.previous ? `${s.previous} ← ` : ''}
                        {s.stage}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-slate-500">{title}</h3>
      {children}
    </div>
  )
}
