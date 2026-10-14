import { Link } from 'react-router-dom'
import { BookOpenCheck } from 'lucide-react'
import { useLearnAttempts, useLearnProgress, useLearnTopics } from '../lib/learnApi'
import { formatDate } from '../lib/utils'

/** managers: how far an agent got in each learning topic and how the last quizzes went */
export function LearnSummary({ agentId }: { agentId: string }) {
  const topics = useLearnTopics()
  const progress = useLearnProgress(agentId)
  const attempts = useLearnAttempts(agentId)
  const list = (topics.data ?? []).filter((t) => t.cards > 0)
  if (list.length === 0) return null
  return (
    <section className="card p-4">
      <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-slate-800">
        <BookOpenCheck size={16} className="text-brand-500" /> לומדה
      </h2>
      <ul className="divide-y divide-slate-100">
        {list.map((t) => {
          const known = (progress.data ?? []).filter((p) => p.topic_id === t.id && p.known).length
          const mine = (attempts.data ?? []).filter((a) => a.topic_id === t.id)
          const pct = Math.round((known / t.cards) * 100)
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link to={`/learn/${t.id}`} className="font-medium text-brand-700 hover:underline">
                {t.title}
              </Link>
              <span className="flex items-center gap-3 text-xs text-slate-500">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </span>
                ידוע {known}/{t.cards} ({pct}%)
                {mine[0] ? ` · מבחן אחרון ${mine[0].score}/${mine[0].total} (${formatDate(mine[0].taken_at.slice(0, 10))})` : ' · לא נבחן'}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
