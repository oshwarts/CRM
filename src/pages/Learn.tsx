import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useLearnProgress, useLearnTopics, useSaveTopic } from '../lib/learnApi'
import { EmptyState, ErrorState, Field, Modal, Spinner } from '../components/ui'

/** the learning module: topics, each with my progress */
export default function Learn() {
  const { user, isAdmin } = useAuth()
  const topics = useLearnTopics()
  const progress = useLearnProgress(user?.id)
  const save = useSaveTopic()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  if (topics.isLoading) return <Spinner />
  if (topics.error && !topics.data) return <ErrorState error={topics.error} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <GraduationCap size={24} className="text-brand-500" />
            לומדה
          </h1>
          <p className="text-sm text-slate-400">נושאי למידה עם כרטיסיות הפוך-וזכור ומבחן אמריקאי. ההתקדמות נשמרת לכל משתמש.</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> נושא חדש
          </button>
        )}
      </div>

      {(topics.data ?? []).length === 0 ? (
        <EmptyState title="אין נושאים" hint={isAdmin ? 'הוסף נושא ואז ייבא אליו שאלות' : 'המנהל עדיין לא הוסיף נושאי למידה'} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(topics.data ?? []).map((t) => {
            const mine = (progress.data ?? []).filter((p) => p.topic_id === t.id)
            const known = mine.filter((p) => p.known).length
            const pct = t.cards ? Math.round((known / t.cards) * 100) : 0
            return (
              <li key={t.id}>
                <Link to={`/learn/${t.id}`} className="card block p-4 transition hover:border-brand-300">
                  <p className="font-semibold text-slate-800">{t.title}</p>
                  {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    {t.cards} שאלות {t.cards > 0 && `· ידוע ${known} (${pct}%)`}
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
    </div>
  )
}
