import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, GraduationCap, Lock, Plus, Repeat, Route, Settings2 } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { bestPercent, useApprove, useCanEditLearning, useLearnAttempts, useLearnProgress, useLearnTopics, usePendingApprovals, useSaveTopic, useTracks } from '../lib/learnApi'
import { TrackManager } from '../components/TrackManager'
import { LearnStats } from '../components/LearnStats'
import { EmptyState, ErrorState, Field, Modal, Spinner } from '../components/ui'
import { classNames, todayISO } from '../lib/utils'

const AUDIENCE: Record<string, string> = { new: 'לסוכן חדש', veteran: 'לסוכן ותיק', all: '' }

/** the learning module: my tracks, the spaced-repetition review, and all topics */
export default function Learn() {
  const { user, isAdmin } = useAuth()
  const canEdit = useCanEditLearning()
  const topics = useLearnTopics()
  const tracks = useTracks()
  const progress = useLearnProgress(user?.id)
  const attempts = useLearnAttempts(user?.id)
  const pending = usePendingApprovals(canEdit)
  const approve = useApprove()
  const save = useSaveTopic()
  const [adding, setAdding] = useState(false)
  const [managing, setManaging] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  if (topics.isLoading) return <Spinner />
  if (topics.error && !topics.data) return <ErrorState error={topics.error} />

  const today = todayISO()
  const topicOf = (id: string) => (topics.data ?? []).find((t) => t.id === id)
  const best = bestPercent(attempts.data ?? [])
  const due = (progress.data ?? []).filter((p) => p.due_on <= today && (p.correct_count > 0 || p.wrong_count > 0)).length
  const waiting = pending.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <GraduationCap size={24} className="text-brand-500" />
            לומדה
          </h1>
          <p className="text-sm text-slate-400">מסלולי למידה, שיעורים, כרטיסיות, מבחנים ומקרים קליניים. ההתקדמות נשמרת לכל משתמש.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button className="btn-secondary" onClick={() => setManaging(true)}>
              <Settings2 size={15} /> מסלולים
            </button>
          )}
          {canEdit && (
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> נושא חדש
            </button>
          )}
        </div>
      </div>

      <LearnStats />

      {due > 0 && (
        <Link to="/learn/review" className="card flex items-center justify-between gap-3 border-brand-300 bg-brand-50/50 p-4 transition hover:bg-brand-50">
          <span className="flex items-center gap-3">
            <Repeat size={22} className="text-brand-600" />
            <span>
              <span className="block font-semibold text-slate-800">{due} שאלות לחזרה היום</span>
              <span className="block text-xs text-slate-500">חזרה קצרה בזמן הנכון משפרת זיכרון — כמה דקות מספיקות</span>
            </span>
          </span>
          <span className="btn-primary">התחל חזרה</span>
        </Link>
      )}

      {canEdit && waiting.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-amber-800">{waiting.length} פריטים ממתינים לאישור מנהל</p>
            {isAdmin && (
              <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" disabled={approve.isPending} onClick={() => approve.mutate(waiting)}>
                <Check size={15} /> אשר הכול
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {waiting.slice(0, 8).map((w) => (
              <li key={`${w.table}-${w.id}`} className="flex items-center justify-between gap-2">
                <Link to={`/learn/${w.topic_id}`} dir="auto" className="min-w-0 truncate hover:underline">
                  {topicOf(w.topic_id)?.title}: {w.label}
                </Link>
                {isAdmin && (
                  <button className="shrink-0 text-xs text-emerald-700 hover:underline" onClick={() => approve.mutate([w])}>
                    אשר
                  </button>
                )}
              </li>
            ))}
            {waiting.length > 8 && <li className="text-xs text-amber-700">ועוד {waiting.length - 8}…</li>}
          </ul>
        </div>
      )}

      {(tracks.data ?? [])
        .filter((t) => t.items.length > 0)
        .map((t) => {
          let blocked = false
          const doneCount = t.items.filter((i) => (best.get(i.topic_id) ?? -1) >= i.pass_pct).length
          return (
            <section key={t.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold text-brand-800">
                  <Route size={16} className="text-brand-500" />
                  {t.title}
                  {AUDIENCE[t.audience] && <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-[11px] text-slate-500">{AUDIENCE[t.audience]}</span>}
                </h2>
                <span className="text-xs text-slate-500">
                  {doneCount}/{t.items.length} שלבים הושלמו
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500" style={{ width: `${(doneCount / t.items.length) * 100}%` }} />
              </div>
              <ol className="space-y-2">
                {t.items.map((it, i) => {
                  const topic = topicOf(it.topic_id)
                  const score = best.get(it.topic_id)
                  const passed = score !== undefined && score >= it.pass_pct
                  const locked = blocked
                  if (!passed) blocked = true
                  const body = (
                    <>
                      <span className={classNames('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold', passed ? 'bg-emerald-100 text-emerald-700' : locked ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-700')}>
                        {passed ? <Check size={14} /> : locked ? <Lock size={13} /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-800">{topic?.title ?? '—'}</span>
                        <span className="block text-xs text-slate-500">
                          {passed ? `עברת בציון ${score}%` : locked ? 'נפתח אחרי שתעבור את השלב הקודם' : score !== undefined ? `ציון אחרון גבוה: ${score}% · נדרש ${it.pass_pct}%` : `מבחן מסכם · ציון עובר ${it.pass_pct}%`}
                        </span>
                      </span>
                    </>
                  )
                  return (
                    <li key={it.id}>
                      {locked ? (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 opacity-70">{body}</div>
                      ) : (
                        <Link to={`/learn/${it.topic_id}`} className={classNames('flex items-center gap-3 rounded-lg border p-2.5 transition hover:border-brand-300', passed ? 'border-emerald-100 bg-emerald-50/40' : 'border-brand-200 bg-white')}>
                          {body}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}

      <section className="space-y-2">
        <h2 className="font-semibold text-brand-800">כל הנושאים</h2>
        {(topics.data ?? []).length === 0 ? (
          <EmptyState title="אין נושאים" hint={canEdit ? 'הוסף נושא ואז שיעורים, שאלות ומקרים' : 'עדיין לא הוסיפו נושאי למידה'} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(topics.data ?? []).map((t) => {
              const known = (progress.data ?? []).filter((p) => p.topic_id === t.id && p.known).length
              const pct = t.cards ? Math.round((known / t.cards) * 100) : 0
              return (
                <li key={t.id}>
                  <Link to={`/learn/${t.id}`} className="card block p-4 transition hover:border-brand-300">
                    <p className="font-semibold text-slate-800">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                    <p className="mt-2 text-xs text-slate-500">
                      {t.cards} שאלות {t.cards > 0 && `· ידוע ${known} (${pct}%)`}
                      {best.get(t.id) !== undefined && ` · מבחן: ${best.get(t.id)}%`}
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Modal open={adding} onClose={() => setAdding(false)} title="נושא חדש" size="md">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate({ title, description, sort: (topics.data ?? []).length }, { onSuccess: () => { setAdding(false); setTitle(''); setDescription('') } })
          }}
        >
          <Field label="שם הנושא">
            <input className="input" required dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="תיאור קצר">
            <input className="input" dir="auto" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
              ביטול
            </button>
            <button className="btn-primary" disabled={!title.trim() || save.isPending}>
              צור
            </button>
          </div>
        </form>
      </Modal>
      {managing && <TrackManager onClose={() => setManaging(false)} />}
    </div>
  )
}
