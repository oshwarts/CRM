import { Check, FileUp, X } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { LARGE_LIMIT, useDecideUpload, useUploadRequests, type UploadRequest } from '../lib/largeFiles'
import { toast } from '../lib/toast'
import { classNames, formatDate } from '../lib/utils'
import { EmptyState, Spinner } from './ui'

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)}MB`
const STATUS: Record<UploadRequest['status'], { label: string; chip: string }> = {
  pending: { label: 'ממתינה לאישור', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  approved: { label: 'אושרה — ממתינה להעלאה', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  rejected: { label: 'נדחתה', chip: 'border-red-200 bg-red-50 text-red-700' },
  used: { label: 'הקובץ הועלה', chip: 'border-slate-200 bg-slate-50 text-slate-500' },
}

/** requests to upload a file over the limit: managers approve or reject; everybody sees their own */
export function UploadRequests() {
  const { isAdmin } = useAuth()
  const q = useUploadRequests()
  const decide = useDecideUpload()
  if (q.isLoading) return <Spinner />
  const rows = q.data ?? []
  const pending = rows.filter((r) => r.status === 'pending')
  const rest = rows.filter((r) => r.status !== 'pending')

  function reject(r: UploadRequest) {
    const note = window.prompt(`לדחות את הבקשה להעלאת "${r.file_name}"? אפשר לכתוב סיבה (לא חובה):`, '')
    if (note === null) return
    decide.mutate({ id: r.id, approve: false, note })
  }

  const row = (r: UploadRequest, actions: boolean) => (
    <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
      <FileUp size={16} className="shrink-0 text-brand-500" />
      <div className="min-w-0 flex-1 basis-40">
        <p dir="auto" className="truncate font-medium text-slate-800">
          {r.file_name}
        </p>
        <p className="text-xs text-slate-500">
          {mb(r.file_size)} · {r.purpose || 'מידע קליני'}
          {isAdmin && r.requester?.full_name ? ` · ${r.requester.full_name}` : ''} · {formatDate(r.created_at.slice(0, 10))}
          {r.decision_note ? ` · ${r.decision_note}` : ''}
        </p>
      </div>
      {actions ? (
        <div className="flex gap-1.5">
          <button type="button" className="btn-primary !py-1" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true }, { onSuccess: () => toast('הבקשה אושרה — המשתמש יכול להעלות את הקובץ') })}>
            <Check size={15} /> אשר
          </button>
          <button type="button" className="btn-secondary !py-1" disabled={decide.isPending} onClick={() => reject(r)}>
            <X size={15} /> דחה
          </button>
        </div>
      ) : (
        <span className={classNames('chip', STATUS[r.status].chip)}>{STATUS[r.status].label}</span>
      )}
    </li>
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        קובץ מעל {mb(LARGE_LIMIT)} (ועד 50MB) מועלה רק באישור מנהל: מי שבוחר קובץ כזה שולח בקשה, ואחרי האישור מעלה אותו שוב. מנהלים מעלים קבצים כאלה ישירות.
      </p>
      {isAdmin && (
        <section className="card p-4">
          <h3 className="mb-1 font-semibold text-slate-800">ממתינות לאישור ({pending.length})</h3>
          {pending.length === 0 ? <p className="py-2 text-sm text-slate-400">אין בקשות ממתינות.</p> : <ul className="divide-y divide-slate-100">{pending.map((r) => row(r, true))}</ul>}
        </section>
      )}
      <section className="card p-4">
        <h3 className="mb-1 font-semibold text-slate-800">{isAdmin ? 'בקשות אחרונות' : 'הבקשות שלי'}</h3>
        {(isAdmin ? rest : rows).length === 0 ? <EmptyState title="אין בקשות" /> : <ul className="divide-y divide-slate-100">{(isAdmin ? rest : rows).map((r) => row(r, false))}</ul>}
      </section>
    </div>
  )
}
