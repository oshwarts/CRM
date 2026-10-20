import { useState } from 'react'
import { ChevronDown, ChevronUp, Flame, Star, Target } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { bestPercent, useLearnAttempts, useLearnDaily, useLearnProgress, useLearnTopics } from '../lib/learnApi'
import { DAILY_GOAL, badgesOf, streakOf } from '../lib/learnGame'
import { classNames, todayISO } from '../lib/utils'

/** my streak, points, today's goal and badges — gentle, personal, no comparison with others */
export function LearnStats({ compact }: { compact?: boolean }) {
  const { user } = useAuth()
  const [showBadges, setShowBadges] = useState(false)
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
    <div className="card space-y-3 p-3 sm:p-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 p-2.5 text-center">
          <Flame size={18} className={classNames('mx-auto', current > 0 ? 'text-orange-500' : 'text-slate-400')} aria-hidden="true" />
          <p className="mt-0.5 text-xl font-bold leading-tight text-slate-800">{current}</p>
          <p className="text-xs text-slate-500">{current === 1 ? 'יום ברצף' : 'ימים ברצף'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5 text-center">
          <Star size={18} className="mx-auto text-amber-500" aria-hidden="true" />
          <p className="mt-0.5 text-xl font-bold leading-tight text-slate-800">{points}</p>
          <p className="text-xs text-slate-500">נקודות</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5 text-center">
          <Target size={18} className={classNames('mx-auto', pct >= 100 ? 'text-emerald-600' : 'text-brand-600')} aria-hidden="true" />
          <p className="mt-0.5 text-xl font-bold leading-tight text-slate-800">
            {Math.min(todayRow?.answers ?? 0, DAILY_GOAL)}/{DAILY_GOAL}
          </p>
          <p className="text-xs text-slate-500">יעד להיום</p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="יעד יומי"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div className={classNames('h-full transition-all', pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500">{best > current ? `השיא שלך: ${best} ימים ברצף` : current === 0 ? 'ענה על שאלה אחת כדי להתחיל רצף' : 'כל הכבוד, ממשיכים'} · נקודות על כל תשובה, ובונוס על מבחן</p>
      {!compact && (
        <div>
          <button type="button" aria-expanded={showBadges} className="flex w-full items-center justify-between gap-2 text-sm font-medium text-slate-700" onClick={() => setShowBadges((v) => !v)}>
            <span>
              תגים: {earned.length} מתוך {badges.length}
            </span>
            {showBadges ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
          {showBadges && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span
                  key={b.id}
                  title={b.earned ? b.hint : `עדיין לא: ${b.hint}`}
                  className={classNames('chip !px-2 !py-0.5 text-xs', b.earned ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-500 grayscale')}
                >
                  {b.icon} {b.title}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {compact && earned.length > 0 && <p className="text-xs text-slate-500">{earned.length} תגים הושגו</p>}
    </div>
  )
}
