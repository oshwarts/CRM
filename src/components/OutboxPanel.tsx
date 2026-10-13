import { useState } from 'react'
import { AlertTriangle, Clock, RefreshCw, Trash2 } from 'lucide-react'
import { discardOp, drain, resolveConflict, retryOp, useOutbox, type Op } from '../lib/outbox'
import { useOnline } from '../lib/offline'
import { FIELD_LABELS } from './AuditLog'
import { Modal } from './ui'

const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'כן' : 'לא') : String(v))

function ConflictCard({ op }: { op: Op }) {
  const [choice, setChoice] = useState<Record<string, 'server' | 'mine'>>({})
  const conflicts = op.conflicts ?? []
  const ready = conflicts.every((c) => choice[c.field])
  return (
    <div className="space-y-2">
      <p className="text-xs text-red-600">משתמש אחר שינה את אותם שדות בזמן שלא היה חיבור. בחר איזה ערך לשמור:</p>
      {conflicts.map((c) => (
        <div key={c.field} className="rounded-lg border border-slate-200 p-2 text-sm">
          <p className="mb-1 text-xs font-medium text-slate-500">{FIELD_LABELS[c.field] ?? c.field}</p>
          {(['server', 'mine'] as const).map((who) => (
            <label key={who} className="flex cursor-pointer items-start gap-2 py-0.5">
              <input type="radio" name={`${op.id}-${c.field}`} checked={choice[c.field] === who} onChange={() => setChoice((x) => ({ ...x, [c.field]: who }))} />
              <span dir="auto" className="min-w-0 break-words">
                <span className="text-xs text-slate-400">{who === 'server' ? 'הגרסה בשרת: ' : 'השינוי שלי: '}</span>
                {show(who === 'server' ? c.server : c.mine)}
              </span>
            </label>
          ))}
        </div>
      ))}
      <button className="btn-primary" disabled={!ready} onClick={() => resolveConflict(op.id, choice)}>
        החל בחירה
      </button>
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
              <button className="btn-secondary" disabled={!online || draining} onClick={() => drain()}>
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
                        <button className="btn-secondary" onClick={() => retryOp(op.id)} disabled={!online}>
                          נסה שוב
                        </button>
                        <button className="btn-ghost text-red-500" onClick={() => discardOp(op.id)}>
                          <Trash2 size={14} /> מחק את השינוי
                        </button>
                      </div>
                    </div>
                  )}
                  {op.state === 'pending' && (
                    <button
                      className="mt-1 text-xs text-slate-400 hover:text-red-500 hover:underline"
                      onClick={() => {
                        if (window.confirm('למחוק את השינוי? הוא לא יישלח.')) discardOp(op.id)
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
