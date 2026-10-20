import { useState } from 'react'
import { Check, Eye, X } from 'lucide-react'
import { SUGGESTION_KIND_LABELS, SUGGESTION_STATUS_LABELS, useAnswerSuggestion, useSuggestions, type Suggestion, type SuggestionStatus } from '../lib/suggestions'
import { toast } from '../lib/toast'
import { classNames, formatDate } from '../lib/utils'
import { EmptyState, Spinner } from './ui'

const FILTERS: [SuggestionStatus | 'all', string][] = [
  ['new', 'חדשות'],
  ['seen', 'נקראו'],
  ['done', 'טופלו'],
  ['declined', 'לא תיושם'],
  ['all', 'הכול'],
]

/** the developer's inbox: every suggestion of every user, with a status and a short answer that the sender sees */
export function SuggestionsInbox() {
  const q = useSuggestions()
  const answer = useAnswerSuggestion()
  const [filter, setFilter] = useState<SuggestionStatus | 'all'>('new')
  const [notes, setNotes] = useState<Record<string, string>>({})
  if (q.isLoading) return <Spinner />
  const all = q.data ?? []
  const shown = all.filter((s) => filter === 'all' || s.status === filter)
  const count = (st: SuggestionStatus | 'all') => (st === 'all' ? all.length : all.filter((s) => s.status === st).length)

  function set(s: Suggestion, status: SuggestionStatus) {
    answer.mutate({ id: s.id, status, dev_note: notes[s.id] ?? s.dev_note }, { onSuccess: () => toast('עודכן'), onError: () => toast('העדכון נכשל', { kind: 'error' }) })
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="סינון הצעות" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={classNames('chip shrink-0', filter === k ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600')}
          >
            {label} {count(k)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="אין הצעות" hint="הצעות שמשתמשים שולחים מופיעות כאן" />
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => (
            <li key={s.id} className="card space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className={classNames('chip !py-0', s.kind === 'problem' ? 'border-red-200 bg-red-50 text-red-700' : 'border-brand-200 bg-brand-50 text-brand-700')}>{SUGGESTION_KIND_LABELS[s.kind]}</span>
                <span className="font-medium text-slate-700">{s.author?.full_name || s.author?.email || '—'}</span>
                <span>{formatDate(s.created_at.slice(0, 10))}</span>
                {s.page && <span dir="ltr">{s.page}</span>}
                <span className="ms-auto">{SUGGESTION_STATUS_LABELS[s.status]}</span>
              </div>
              <p dir="auto" className="whitespace-pre-line text-sm text-slate-800 [overflow-wrap:anywhere]">
                {s.body}
              </p>
              <input
                className="input"
                dir="auto"
                aria-label="תשובה קצרה לשולח (לא חובה)"
                placeholder="תשובה קצרה לשולח (לא חובה)"
                value={notes[s.id] ?? s.dev_note}
                onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2 sm:flex">
                <button type="button" className="btn-secondary" disabled={answer.isPending} onClick={() => set(s, 'seen')}>
                  <Eye size={15} /> נקראה
                </button>
                <button type="button" className="btn-primary" disabled={answer.isPending} onClick={() => set(s, 'done')}>
                  <Check size={15} /> טופלה
                </button>
                <button type="button" className="btn-secondary" disabled={answer.isPending} onClick={() => set(s, 'declined')}>
                  <X size={15} /> לא תיושם
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
