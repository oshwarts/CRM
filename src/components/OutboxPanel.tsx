import { useState } from 'react'
import { AlertTriangle, Clock, RefreshCw, Trash2 } from 'lucide-react'
import { discardOp, drain, resolveConflict, retryOp, useOutbox, type Op } from '../lib/outbox'
import { useOnline } from '../lib/offline'
import { queryClient } from '../lib/queryClient'
import { conflictFieldLabel, conflictValue } from '../lib/conflictFormat'
import { FIELD_LABELS } from './AuditLog'
import { Modal } from './ui'

const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))

/** the name of a doctor / hospital / person that a field points to, from what the app already loaded */
function nameOf(field: string, id: string): string | undefined {
  const find = <T extends { id: string }>(key: string) => queryClient.getQueryData<T[]>([key])?.find((x) => x.id === id)
  if (field === 'doctor_id' || field === 'surgeon_id') {
    const d = find<{ id: string; name: string; title?: string }>('doctors')
    return d && `${d.title ?? ''} ${d.name}`.trim()
  }
  if (field === 'hospital_id') return find<{ id: string; name: string }>('hospitals')?.name
  if (field === 'coordinator_contact_id') return find<{ id: string; name: string }>('contacts')?.name
  const a = find<{ id: string; full_name: string; email?: string }>('agents')
  return a && (a.full_name || a.email)
}

function ConflictCard({ op }: { op: Op }) {
  const [choice, setChoice] = useState<Record<string, 'server' | 'mine'>>({})
  const [busy, setBusy] = useState(false)
  const conflicts = op.conflicts ?? []
  const ready = conflicts.every((c) => choice[c.field])
  const all = (who: 'server' | 'mine') => setChoice(Object.fromEntries(conflicts.map((c) => [c.field, who])))
  return (
    <div className="space-y-2">
      <p className="text-xs text-red-600">משתמש אחר שינה את אותם שדות בזמן שלא היה חיבור. בחר איזה ערך לשמור:</p>
      {conflicts.map((c) => (
        <div key={c.field} role="radiogroup" aria-label={conflictFieldLabel(c.field, FIELD_LABELS)} className="rounded-lg border border-slate-200 p-2 text-sm">
          <p aria-hidden className="mb-1 text-xs font-medium text-slate-500">{conflictFieldLabel(c.field, FIELD_LABELS)}</p>
          {(['server', 'mine'] as const).map((who) => (
            <label key={who} className="flex cursor-pointer items-start gap-2 py-0.5">
              <input type="radio" name={`${op.id}-${c.field}`} checked={choice[c.field] === who} onChange={() => setChoice((x) => ({ ...x, [c.field]: who }))} />
              <span dir="auto" className="min-w-0 break-words">
                <span className="text-xs text-slate-400">{who === 'server' ? 'הגרסה בשרת: ' : 'השינוי שלי: '}</span>
                {conflictValue(c.field, who === 'server' ? c.server : c.mine, nameOf)}
              </span>
            </label>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          disabled={!ready || busy}
          onClick={() => {
            setBusy(true)
            void resolveConflict(op.id, choice).finally(() => setBusy(false))
          }}
        >
          החל בחירה
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={() => all('server')}>
          הכול כמו בשרת
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={() => all('mine')}>
          הכול כמו אצלי
        </button>
      </div>
    </div>
  )
}

/** every change waiting to be sent, with what to do about the ones that failed or collided with someone else's edit */
export function OutboxPanel({ onClose }: { onClose: () => void }) {
  const { ops, draining } = useOutbox()
  const online = useOnline()

  return (
    <Modal open onClose={onClose} title="שינויים שממתינים לשליחה" size="md">
      <div className="space-y-3">
        {ops.length === 0 ? (
          <p className="text-sm text-slate-500">אין שינויים ממתינים. הכול נשלח.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-500">
                {online ? 'השינויים נשלחים אוטומטית. אפשר גם לשלוח עכשיו.' : 'אין חיבור — השינויים יישלחו כשהחיבור יחזור.'}
              </p>
              <button className="btn-secondary shrink-0 whitespace-nowrap" disabled={!online || draining} onClick={() => void drain()}>
                <RefreshCw size={14} className={draining ? 'animate-spin' : ''} />
                שלח עכשיו
              </button>
            </div>
            <ul className="space-y-2">
              {ops.map((op) => (
                <li key={op.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p dir="auto" className="break-words text-sm font-medium text-slate-800">
                        {op.label}
                      </p>
                      <p className="text-xs text-slate-400">נשמר ב-{fmtTime(op.createdAt)}</p>
                    </div>
                    {op.state === 'pending' && (
                      <span className="chip shrink-0 border-amber-200 bg-amber-50 !px-2 !py-0 text-xs text-amber-700">
                        <Clock size={12} /> ממתין
                      </span>
                    )}
                    {op.state === 'conflict' && (
                      <span className="chip shrink-0 border-red-200 bg-red-50 !px-2 !py-0 text-xs text-red-600">
                        <AlertTriangle size={12} /> התנגשות
                      </span>
                    )}
                    {op.state === 'failed' && (
                      <span className="chip shrink-0 border-red-200 bg-red-50 !px-2 !py-0 text-xs text-red-600">
                        <AlertTriangle size={12} /> נכשל
                      </span>
                    )}
                  </div>
                  {op.state === 'conflict' && <div className="mt-2"><ConflictCard op={op} /></div>}
                  {op.state === 'failed' && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-red-600">{op.error}</p>
                      <div className="flex gap-2">
                        <button className="btn-secondary" onClick={() => void retryOp(op.id)} disabled={!online}>
                          נסה שוב
                        </button>
                        <button
                          className="btn-ghost text-red-600"
                          onClick={() => {
                            if (window.confirm(`למחוק את השינוי "${op.label}"? הוא לא יישלח והעריכה תאבד.`)) void discardOp(op.id)
                          }}
                        >
                          <Trash2 size={14} /> מחק את השינוי
                        </button>
                      </div>
                    </div>
                  )}
                  {op.state === 'pending' && (
                    <button
                      className="mt-1 min-h-[36px] text-xs text-slate-500 hover:text-red-600 hover:underline"
                      onClick={() => {
                        if (window.confirm(`למחוק את השינוי "${op.label}"? הוא לא יישלח.`)) void discardOp(op.id)
                      }}
                    >
                      ביטול השינוי
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  )
}
