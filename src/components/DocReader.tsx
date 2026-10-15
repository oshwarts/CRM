import { useMemo, useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import { openInfoDocument } from '../lib/api'
import { useDocumentText } from '../lib/docText'
import type { InfoDocument } from '../lib/types'
import { Modal, Spinner } from './ui'

/** highlights the search words inside a paragraph */
function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'))
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="rounded bg-yellow-200 px-0.5">{p}</mark> : <span key={i}>{p}</span>))}
    </>
  )
}

/** a stored document shown as readable text inside the app, with search; managers/editors can draft questions from it */
export function DocReader({ doc, onClose, onGenerate }: { doc: InfoDocument; onClose: () => void; onGenerate?: (text: string) => void }) {
  const text = useDocumentText(doc)
  const [query, setQuery] = useState('')
  const [openError, setOpenError] = useState('')
  const data = text.data
  const pages = data && 'pages' in data ? data.pages : null
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !pages) return 0
    return pages.reduce((n, p) => n + (p.toLowerCase().split(q).length - 1), 0)
  }, [query, pages])

  return (
    <Modal open onClose={onClose} title={doc.title} size="xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" className="input !w-56" placeholder="חיפוש בתוך המסמך…" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query.trim() && pages && <span className="text-xs text-slate-500">{hits} תוצאות</span>}
          <span className="mr-auto flex flex-wrap gap-2">
            {pages && onGenerate && (
              <button className="btn-secondary" onClick={() => onGenerate(pages.join('\n\n'))}>
                <Sparkles size={15} /> צור שאלות מהמסמך
              </button>
            )}
            <button className="btn-secondary" onClick={async () => setOpenError((await openInfoDocument(doc)) ?? '')}>
              <ExternalLink size={15} /> פתח את הקובץ המקורי
            </button>
          </span>
        </div>
        {openError && <p className="text-sm text-red-600">{openError}</p>}
        {text.isLoading && <Spinner label="קורא את המסמך…" />}
        {text.error && <p className="text-sm text-red-600">{text.error instanceof Error ? text.error.message : 'הקריאה נכשלה'}</p>}
        {data && 'unsupported' in data && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{data.unsupported}</p>}
        {pages && (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
            {pages.map((p, i) => (
              <section key={i}>
                {pages.length > 1 && <p className="mb-1 text-[11px] font-semibold text-slate-300">עמוד {i + 1}</p>}
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  <Highlighted text={p} query={query} />
                </p>
              </section>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400">התצוגה היא טקסט שחולץ מהקובץ: תמונות, תרשימים וטבלאות מורכבות לא יופיעו — הם בקובץ המקורי.</p>
      </div>
    </Modal>
  )
}
