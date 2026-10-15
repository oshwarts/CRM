import { Flame, Target } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { bestPercent, useLearnAttempts, useLearnDaily, useLearnProgress, useLearnTopics } from '../lib/learnApi'
import { DAILY_GOAL, badgesOf, streakOf } from '../lib/learnGame'
import { classNames, todayISO } from '../lib/utils'

/** my streak, points, today's goal and badges — gentle, personal, no comparison with others */
export function LearnStats({ compact }: { compact?: boolean }) {
  const { user } = useAuth()
  const daily = useLearnDaily(user?.id)
  const progress = useLearnProgress(user?.id)
  const attempts = useLearnAttempts(user?.id)
  const topics = useLearnTopics()
  const today = todayISO()
  const days = daily.data ?? []
  const todayRow = days.find((d) => d.day === today)
  const { current, best } = streakOf(days, today)
  const points = days.reduce((n, d) => n + d.points, 0)
  const answers = days.reduce((n, d) => n + d.answers, 0)
  const pct = Math.min(100, Math.round(((todayRow?.answers ?? 0) / DAILY_GOAL) * 100))
  const mastered = (topics.data ?? []).filter((t) => {
    if (t.cards < 10) return false
    const known = (progress.data ?? []).filter((p) => p.topic_id === t.id && p.known).length
    return known / t.cards >= 0.9
  }).length
  const perfect = (attempts.data ?? []).filter((a) => a.total > 0 && a.score === a.total).length
  const badges = badgesOf({ days, streakBest: best, perfectQuizzes: perfect, topicsMastered: mastered, answers })
  const earned = badges.filter((b) => b.earned)
  void bestPercent

  if (daily.isLoading) return null
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <Flame size={22} className={current > 0 ? 'text-orange-500' : 'text-slate-300'} />
          <div>
            <p className="text-lg font-bold leading-tight text-slate-800">{current} {current === 1 ? 'יום' : 'ימים'} ברצף</p>
            <p className="text-xs text-slate-400">{best > current ? `השיא שלך: ${best}` : current === 0 ? 'ענה על שאלה אחת כדי להתחיל רצף' : 'כל הכבוד, ממשיכים'}</p>
          </div>
        </div>
        <div>
          <p className="text-lg font-bold leading-tight text-slate-800">{points} נקודות</p>
          <p className="text-xs text-slate-400">על כל תשובה, ועוד בונוס על מבחן</p>
        </div>
        <div className="min-w-40 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Target size={13} /> יעד יומי: {Math.min(todayRow?.answers ?? 0, DAILY_GOAL)}/{DAILY_GOAL} תשובות
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={classNames('h-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.id}
              title={b.earned ? b.hint : `עדיין לא: ${b.hint}`}
              className={classNames('chip !px-2 !py-0.5 text-xs', b.earned ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-100 bg-slate-50 text-slate-300 grayscale')}
            >
              {b.icon} {b.title}
            </span>
          ))}
        </div>
      )}
      {compact && earned.length > 0 && <p className="text-xs text-slate-400">{earned.length} תגים הושגו</p>}
    </div>
  )
}
