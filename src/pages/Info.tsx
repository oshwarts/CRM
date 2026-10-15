import { useMemo, useState } from 'react'
import { FileText, FolderUp, Image as ImageIcon, Link2, Pencil, Plus, Presentation, Search, Trash2 } from 'lucide-react'
import {
  openInfoDocument,
  useDeleteInfoDoc,
  useInfoCategories,
  useInfoDocuments,
  useProcedures,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { InfoDocModal } from '../components/InfoDocModal'
import { InfoFolderImport } from '../components/InfoFolderImport'
import { ConfirmButton, EmptyState, ErrorState, Spinner } from '../components/ui'
import { normalizeHe } from '../lib/contactMatch'
import type { InfoDocument } from '../lib/types'
import { classNames, formatDate } from '../lib/utils'

const GENERAL = 'general'

function iconFor(d: InfoDocument) {
  const name = (d.file_name || d.url).toLowerCase()
  if (d.kind === 'link') return { Icon: Link2, cls: 'bg-sky-50 text-sky-600' }
  if (/\.pdf$/.test(name) || d.mime === 'application/pdf') return { Icon: FileText, cls: 'bg-red-50 text-red-600' }
  if (/\.pptx?$/.test(name)) return { Icon: Presentation, cls: 'bg-orange-50 text-orange-600' }
  if (/\.(png|jpe?g|webp|gif)$/.test(name) || d.mime.startsWith('image/')) return { Icon: ImageIcon, cls: 'bg-emerald-50 text-emerald-600' }
  return { Icon: FileText, cls: 'bg-blue-50 text-blue-600' }
}

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`)

export default function Info() {
  const { isAdmin } = useAuth()
  const docs = useInfoDocuments()
  const categories = useInfoCategories()
  const procedures = useProcedures()
  const del = useDeleteInfoDoc()

  const [q, setQ] = useState('')
  const [procFilter, setProcFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState<InfoDocument | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  const procName = useMemo(() => new Map((procedures.data ?? []).map((p) => [p.id, p.name])), [procedures.data])
  const catSort = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.sort])), [categories.data])

  const procIdsOf = (d: InfoDocument) => (d.procedures.length ? d.procedures.map((p) => p.procedure_id) : [GENERAL])

  const words = normalizeHe(q).split(' ').filter(Boolean)
  const searching = words.length > 0

  const matches = useMemo(() => {
    const list = (docs.data ?? []).filter((d) => {
      if (catFilter && d.category_id !== catFilter) return false
      if (procFilter && !procIdsOf(d).includes(procFilter)) return false
      if (!words.length) return true
      const hay = normalizeHe(
        [
          d.title,
          d.description,
          d.file_name,
          d.category?.name,
          ...d.tags,
          ...d.procedures.map((p) => procName.get(p.procedure_id)),
          d.procedures.length ? '' : 'כללי',
        ]
          .filter(Boolean)
          .join(' '),
      )
      return words.every((w) => hay.includes(w))
    })
    return list.sort(
      (a, b) =>
        (catSort.get(a.category_id ?? '') ?? 99) - (catSort.get(b.category_id ?? '') ?? 99) ||
        a.title.localeCompare(b.title, 'he'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.data, catFilter, procFilter, q, procName, catSort])

  // not searching → grouped by procedure (documents of several procedures appear in each)
  const sections = useMemo(() => {
    const order = [...(procedures.data ?? []).map((p) => ({ key: p.id, name: p.name })), { key: GENERAL, name: 'כללי — לכל הפרוצדורות' }]
    return order
      .filter((s) => !procFilter || s.key === procFilter)
      .map((s) => ({ ...s, docs: matches.filter((d) => procIdsOf(d).includes(s.key)) }))
      .filter((s) => s.docs.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, procedures.data, procFilter])

  async function open(d: InfoDocument) {
    setError((await openInfoDocument(d)) ?? '')
  }

  const card = (d: InfoDocument, showProcs: boolean) => {
    const { Icon, cls } = iconFor(d)
    return (
      <li key={d.id} className="flex items-stretch gap-1">
        <button
          onClick={() => open(d)}
          className="card flex min-w-0 flex-1 items-start gap-3 p-3 text-right transition hover:border-brand-300 hover:shadow-sm"
        >
          <span className={classNames('grid h-10 w-10 shrink-0 place-items-center rounded-lg', cls)}>
            <Icon size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block break-words text-sm font-semibold text-slate-800">
              {d.title}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-400">
              {d.category && <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-slate-600">{d.category.name}</span>}
              {showProcs &&
                procIdsOf(d).map((id) => (
                  <span key={id} className="chip border-brand-200 bg-brand-50 !px-2 !py-0 text-brand-700">
                    {id === GENERAL ? 'כללי' : procName.get(id)}
                  </span>
                ))}
              {d.kind === 'file' ? fmtSize(d.file_size) : 'קישור'}
              {' · '}
              {formatDate(d.created_at.slice(0, 10))}
              {d.uploader?.full_name ? ` · ${d.uploader.full_name}` : ''}
            </span>
            {d.description && <span className="mt-1 line-clamp-2 block text-xs text-slate-500">{d.description}</span>}
            {d.tags.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-1">
                {d.tags.map((t) => (
                  <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                    #{t}
                  </span>
                ))}
              </span>
            )}
          </span>
        </button>
        <div className="flex flex-col justify-center">
          <button className="btn-ghost !px-2" onClick={() => setEditing(d)} aria-label="עריכה">
            <Pencil size={15} />
          </button>
          {isAdmin && (
            <ConfirmButton
              className="btn-ghost !px-2 text-red-500"
              onConfirm={() => del.mutate(d, { onError: (e) => setError(e instanceof Error ? e.message : 'המחיקה נכשלה') })}
            >
              <Trash2 size={15} />
            </ConfirmButton>
          )}
        </div>
      </li>
    )
  }

  if (docs.isLoading) return <Spinner />
  if (docs.error && !docs.data) return <ErrorState error={docs.error} /> // cached data stays visible when only a background refresh failed

  const chip = (key: string, label: string) => (
    <button
      key={key || 'all'}
      onClick={() => setProcFilter(key)}
      className={classNames(
        'chip shrink-0 transition',
        procFilter === key ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">מידע קליני</h1>
          <p className="text-sm text-slate-400">פרוטוקולים, טכניקות ניתוח, מחקרים ומידע על הציוד — לפי פרוצדורה</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setImporting(true)}>
            <FolderUp size={16} />
            ייבוא תיקייה
          </button>
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            העלאת מסמך
          </button>
        </div>
      </div>

      <div className="card space-y-3 p-3 sm:p-4">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input !py-2.5 !pr-10 text-base"
            placeholder="חיפוש בכל המסמכים: שם, קטגוריה, פרוצדורה, תגית…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {chip('', 'הכול')}
          {(procedures.data ?? []).map((p) => chip(p.id, p.name))}
          {chip(GENERAL, 'כללי')}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input !w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">כל הקטגוריות</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-400">
            {matches.length} מסמכים{searching || procFilter || catFilter ? ' תואמים' : ''}
          </span>
          {(searching || procFilter || catFilter) && (
            <button
              className="text-sm text-brand-600 hover:underline"
              onClick={() => {
                setQ('')
                setProcFilter('')
                setCatFilter('')
              }}
            >
              נקה
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {matches.length === 0 ? (
        <EmptyState
          title={docs.data?.length ? 'לא נמצאו מסמכים' : 'עדיין לא הועלו מסמכים'}
          hint={docs.data?.length ? 'נסה לשנות את החיפוש או הסינון' : 'לחץ על "העלאת מסמך" כדי להתחיל'}
        />
      ) : searching ? (
        <ul className="grid gap-2 lg:grid-cols-2">{matches.map((d) => card(d, true))}</ul>
      ) : (
        sections.map((s) => (
          <section key={s.key} className="space-y-2">
            <h2 className="flex items-baseline gap-2 text-lg font-semibold text-brand-800">
              {s.name}
              <span className="text-sm font-normal text-slate-400">{s.docs.length}</span>
            </h2>
            <ul className="grid gap-2 lg:grid-cols-2">{s.docs.map((d) => card(d, false))}</ul>
          </section>
        ))
      )}

      {adding && (
        <InfoDocModal
          defaultProcedureId={procFilter && procFilter !== GENERAL ? procFilter : undefined}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && <InfoDocModal doc={editing} onClose={() => setEditing(null)} />}
      {importing && <InfoFolderImport onClose={() => setImporting(false)} />}
    </div>
  )
}
