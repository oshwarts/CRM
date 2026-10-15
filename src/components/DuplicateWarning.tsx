import { AlertTriangle } from 'lucide-react'
import { openInfoDocument } from '../lib/api'
import { REASON_LABEL, type DupMatch } from '../lib/docDuplicates'
import type { InfoDocument } from '../lib/types'
import { classNames } from '../lib/utils'

/** "a similar document already exists": what it is, how it matches, and (optionally) a way to use it instead */
export function DuplicateWarning({ title, matches, onUse }: { title?: string; matches: DupMatch[]; onUse?: (doc: InfoDocument) => void }) {
  if (matches.length === 0) return null
  const identical = matches.some((m) => m.reason === 'identical')
  return (
    <div className={classNames('rounded-lg border px-3 py-2 text-sm', identical ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
      <p className="mb-1 flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={14} />
        {title ?? (identical ? 'הקובץ הזה כבר קיים במערכת' : 'נמצאו מסמכים דומים במערכת')}
      </p>
      <ul className="space-y-1">
        {matches.map((m) => (
          <li key={m.doc.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="chip border-current/20 bg-white/60 !px-1.5 !py-0 text-[11px]">{REASON_LABEL[m.reason]}</span>
            <span dir="auto" className="font-medium">
              {m.doc.title}
            </span>
            {m.doc.category?.name && <span className="opacity-70">· {m.doc.category.name}</span>}
            <button type="button" className="underline" onClick={() => void openInfoDocument(m.doc)}>
              פתח
            </button>
            {onUse && (
              <button type="button" className="rounded bg-white/70 px-1.5 py-0.5 font-semibold underline" onClick={() => onUse(m.doc)}>
                השתמש בקיים
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
