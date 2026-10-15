import { useEffect, useRef, useState } from 'react'
import { FileUp, Link2 } from 'lucide-react'
import {
  INFO_MAX_BYTES,
  useInfoCategories,
  useInfoDocuments,
  useProcedures,
  useSaveInfoDoc,
} from '../lib/api'
import type { InfoDocument } from '../lib/types'
import { fileHash, findSimilarDocs, type DupMatch } from '../lib/docDuplicates'
import { DuplicateWarning } from './DuplicateWarning'
import { classNames } from '../lib/utils'
import { Field, Modal, MultiSelectChips } from './ui'

const stripExt = (n: string) => n.replace(/\.[^.]+$/, '')
const fmtMb = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MB`

/** upload (one or several files, or a link) or edit the details of a document */
export function InfoDocModal({
  doc,
  defaultProcedureId,
  onClose,
}: {
  doc?: InfoDocument
  defaultProcedureId?: string
  onClose: () => void
}) {
  const categories = useInfoCategories()
  const procedures = useProcedures()
  const save = useSaveInfoDoc()
  const library = useInfoDocuments()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'file' | 'link'>(doc?.kind === 'link' ? 'link' : 'file')
  const [files, setFiles] = useState<File[]>([])
  const [url, setUrl] = useState(doc?.url ?? '')
  const [title, setTitle] = useState(doc?.title ?? '')
  const [description, setDescription] = useState(doc?.description ?? '')
  const [categoryId, setCategoryId] = useState(doc?.category_id ?? '')
  const [procedureIds, setProcedureIds] = useState<string[]>(
    doc ? doc.procedures.map((p) => p.procedure_id) : defaultProcedureId ? [defaultProcedureId] : [],
  )
  const [tags, setTags] = useState((doc?.tags ?? []).join(', '))
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  // similar documents already in the library: per picked file (content, name, size), and for the typed title / link
  const [fileDups, setFileDups] = useState<Record<string, DupMatch[]>>({})
  const [allowDup, setAllowDup] = useState(false)
  const others = (library.data ?? []).filter((d) => d.id !== doc?.id)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next: Record<string, DupMatch[]> = {}
      for (const f of files) next[f.name] = findSimilarDocs({ names: [f.name], size: f.size, hash: await fileHash(f) }, others)
      if (!cancelled) setFileDups(next)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, library.data])

  const titleDups = title.trim().length >= 4 && files.length <= 1 ? findSimilarDocs({ names: [title], url: mode === 'link' ? url : undefined }, others) : mode === 'link' && url.trim() ? findSimilarDocs({ names: [], url }, others) : []
  const dupCount = Object.values(fileDups).reduce((n, m) => n + m.length, 0) + titleDups.filter((t) => !Object.values(fileDups).some((m) => m.some((x) => x.doc.id === t.doc.id))).length
  const hasDup = !doc && dupCount > 0

  function pick(list: FileList | null) {
    const arr = [...(list ?? [])]
    const big = arr.find((f) => f.size > INFO_MAX_BYTES)
    if (big) return setError(`הקובץ "${big.name}" גדול מדי (${fmtMb(big.size)}). המקסימום הוא 50MB — לקבצים גדולים השתמש בקישור.`)
    setError('')
    setFiles(arr)
    if (arr.length === 1 && !title) setTitle(stripExt(arr[0].name))
  }

  async function submit() {
    setError('')
    if (hasDup && !allowDup) return setError('נמצאו מסמכים דומים במערכת — בדוק אותם למעלה ואשר שברצונך להעלות בכל זאת')
    const common = {
      description,
      categoryId: categoryId || null,
      procedureIds,
      tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
    }
    try {
      if (doc) {
        if (!title.trim()) return setError('הזן שם למסמך')
        if (doc.kind === 'link' && !/^https?:\/\//i.test(url.trim())) return setError('הקישור צריך להתחיל ב-https://')
        await save.mutateAsync({ ...common, id: doc.id, title, kind: doc.kind === 'link' ? 'link' : 'file', url })
      } else if (mode === 'link') {
        if (!title.trim()) return setError('הזן שם למסמך')
        if (!/^https?:\/\//i.test(url.trim())) return setError('הקישור צריך להתחיל ב-https://')
        await save.mutateAsync({ ...common, title, kind: 'link', url })
      } else {
        if (files.length === 0) return setError('בחר קובץ להעלאה')
        if (files.length === 1 && !title.trim()) return setError('הזן שם למסמך')
        for (const [i, f] of files.entries()) {
          setProgress(`מעלה ${i + 1} מתוך ${files.length}…`)
          await save.mutateAsync({
            ...common,
            title: files.length === 1 ? title : stripExt(f.name),
            kind: 'file',
            url: '',
            file: f,
          })
        }
      }
      onClose()
    } catch (e) {
      setProgress('')
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={doc ? 'עריכת מסמך' : 'העלאת מסמך'} size="lg">
      <div className="space-y-4">
        {!doc && (
          <div className="grid grid-cols-2 gap-2">
            {(['file', 'link'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={classNames(
                  'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition',
                  mode === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {m === 'file' ? <FileUp size={16} /> : <Link2 size={16} />}
                {m === 'file' ? 'קובץ' : 'קישור'}
              </button>
            ))}
          </div>
        )}

        {(doc ? doc.kind === 'file' : mode === 'file') ? (
          doc ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              הקובץ: <span dir="auto">{doc.file_name}</span> ({fmtMb(doc.file_size)}). כדי להחליף קובץ — העלה מסמך חדש.
            </p>
          ) : (
            <div>
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                <FileUp size={16} />
                {files.length ? 'החלף בחירה' : 'בחר קבצים (PDF, Word, מצגות, תמונות)'}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4"
                onChange={(e) => {
                  pick(e.target.files)
                  e.target.value = ''
                }}
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                  {files.map((f) => (
                    <li key={f.name} dir="auto">
                      {f.name} · {fmtMb(f.size)}
                    </li>
                  ))}
                </ul>
              )}
              {files.length > 1 && (
                <p className="mt-1 text-xs text-slate-400">כל קובץ יישמר בשמו, עם אותה קטגוריה ופרוצדורות.</p>
              )}
              {files.map((f) => (
                <div key={f.name} className="mt-2">
                  <DuplicateWarning title={files.length > 1 ? `"${f.name}" — כבר קיים או דומה` : undefined} matches={fileDups[f.name] ?? []} />
                </div>
              ))}
            </div>
          )
        ) : (
          <Field label="קישור (YouTube, SharePoint, אתר היצרן…)">
            <input dir="ltr" className="input text-right" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        )}

        {(doc || mode === 'link' || files.length <= 1) && (
          <Field label="שם המסמך">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        )}
        {!doc && files.length === 0 && <DuplicateWarning matches={titleDups} />}
        {hasDup && (
          <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} />
            בדקתי — אני רוצה להעלות בכל זאת
          </label>
        )}

        <Field label="קטגוריה">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— ללא קטגוריה —</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="פרוצדורות (אפשר כמה; בלי בחירה = כללי)">
          <MultiSelectChips
            options={(procedures.data ?? []).map((p) => ({ id: p.id, label: p.name }))}
            selected={procedureIds}
            onToggle={(id) =>
              setProcedureIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
            }
            labelOf={(o) => o.label}
          />
        </Field>

        <Field label="תיאור (אופציונלי)">
          <textarea className="input min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Field label="תגיות (מופרדות בפסיק, אופציונלי)">
          <input className="input" placeholder="לדוגמה: Triathlon, TKA, MAKO 2.0" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          {progress && <span className="ml-auto text-sm text-slate-500">{progress}</span>}
          <button className="btn-secondary" onClick={onClose} disabled={save.isPending}>
            ביטול
          </button>
          <button className="btn-primary" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'שומר…' : doc ? 'שמירה' : 'העלאה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
