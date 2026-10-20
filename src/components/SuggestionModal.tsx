import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { SUGGESTION_KIND_LABELS, SUGGESTION_STATUS_LABELS, useCreateSuggestion, useSuggestions, type SuggestionKind } from '../lib/suggestions'
import { toast } from '../lib/toast'
import { classNames, formatDate } from '../lib/utils'
import { Field, Modal } from './ui'

const STATUS_CHIP = { new: 'border-slate-200 bg-slate-50 text-slate-600', seen: 'border-sky-200 bg-sky-50 text-sky-700', done: 'border-emerald-200 bg-emerald-50 text-emerald-700', declined: 'border-slate-200 bg-slate-100 text-slate-500' }

/** anybody (agent or manager) sends the developer of the system an idea, or a problem they ran into; the page they were on is attached */
export function SuggestionModal({ onClose }: { onClose: () => void }) {
  const location = useLocation()
  const { user } = useAuth()
  const create = useCreateSuggestion()
  const mine = useSuggestions()
  const [kind, setKind] = useState<SuggestionKind>('idea')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return setError('כתוב מה לשפר או מה לא עובד')
    setError('')
    create.mutate(
      { kind, body, page: location.pathname },
      {
        onSuccess: () => {
          toast('ההצעה נשלחה למפתח המערכת, תודה!')
          onClose()
        },
        onError: () => setError('השליחה נכשלה, נסה שוב'),
      },
    )
  }

  // the developer's list holds everybody's suggestions: here only my own
  const recent = (mine.data ?? []).filter((s) => s.created_by === user?.id).slice(0, 5)
  return (
    <Modal open onClose={onClose} title="הצעה לשיפור המערכת" size="md">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">ההצעה מגיעה למפתח המערכת. אפשר לכתוב רעיון, או משהו שלא עובד או לא נוח.</p>
        <div role="group" aria-label="סוג ההצעה" className="grid grid-cols-2 gap-2">
          {(Object.keys(SUGGESTION_KIND_LABELS) as SuggestionKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={classNames('min-h-[44px] rounded-xl border px-3 text-sm font-medium transition', kind === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
            >
              {SUGGESTION_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <Field label={kind === 'idea' ? 'מה היית רוצה שיהיה?' : 'מה קרה ואיפה?'}>
          <textarea className="input min-h-[120px]" dir="auto" autoFocus maxLength={4000} placeholder={kind === 'idea' ? 'לדוגמה: שיהיה אפשר לשלוח סיכום פגישה בוואטסאפ' : 'לדוגמה: בדף הרופאים הכפתור לא מגיב'} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">
          הדף שבו היית נשלח יחד עם ההצעה: <span dir="ltr">{location.pathname}</span>
        </p>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {recent.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold text-slate-600">ההצעות האחרונות שלי</p>
            <ul className="space-y-1.5">
              {recent.map((s) => (
                <li key={s.id} className="text-xs text-slate-600">
                  <span className={classNames('chip !py-0 text-[11px]', STATUS_CHIP[s.status])}>{SUGGESTION_STATUS_LABELS[s.status]}</span>{' '}
                  <span dir="auto" className="[overflow-wrap:anywhere]">
                    {s.body.length > 90 ? `${s.body.slice(0, 90)}…` : s.body}
                  </span>{' '}
                  <span className="text-slate-400">{formatDate(s.created_at.slice(0, 10))}</span>
                  {s.dev_note && (
                    <span dir="auto" className="block text-slate-700 [overflow-wrap:anywhere]">
                      תשובת המפתח: {s.dev_note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn-primary max-sm:flex-1" disabled={create.isPending}>
            {create.isPending ? 'שולח…' : 'שלח למפתח'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
