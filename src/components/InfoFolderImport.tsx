import { useRef, useState } from 'react'
import { FolderUp } from 'lucide-react'
import { INFO_MAX_BYTES, useInfoCategories, useInfoDocuments, useProcedures, useSaveInfoDoc } from '../lib/api'
import { ALLOWED_EXT, guessCategory, guessProcedure, sha256, titleOf } from '../lib/infoImport'
import { classNames } from '../lib/utils'
import { Modal } from './ui'
import { useAuth } from '../context/AuthProvider'
import { LARGE_LIMIT } from '../lib/largeFiles'

type Row = {
  file: File
  path: string
  title: string
  procedureId: string
  categoryId: string
  include: boolean
  note: string
}

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MB`

/** pick a whole folder (Data/Knee/Mako/…) — procedure and category are guessed, then reviewed */
export function InfoFolderImport({ onClose }: { onClose: () => void }) {
  const { isAdmin } = useAuth()
  const procedures = useProcedures()
  const categories = useInfoCategories()
  const existing = useInfoDocuments()
  const save = useSaveInfoDoc()
  const inputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [skipped, setSkipped] = useState(0)

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)))

  async function onPick(list: FileList | null) {
    setError('')
    const all = [...(list ?? [])]
    const files = all.filter((f) => ALLOWED_EXT.test(f.name) && !f.name.startsWith('~$'))
    setSkipped(all.length - files.length)
    if (files.length === 0) return setError('לא נמצאו קבצים נתמכים בתיקייה (PDF, Word, מצגות, תמונות).')
    setBusy('בודק קבצים…')

    // identical files (same size and same content) are marked as duplicates
    const bySize = new Map<number, File[]>()
    for (const f of files) bySize.set(f.size, [...(bySize.get(f.size) ?? []), f])
    const hashes = new Map<File, string>()
    for (const group of bySize.values()) if (group.length > 1) for (const f of group) hashes.set(f, await sha256(f))
    const seen = new Map<string, string>()
    const known = new Set((existing.data ?? []).map((d) => `${d.file_name}|${d.file_size}`))

    const out: Row[] = files.map((f) => {
      const path = f.webkitRelativePath || f.name
      const folders = path.split('/').slice(1, -1) // drop the root folder name and the file
      let include = true
      let note = ''
      if (f.size > INFO_MAX_BYTES) {
        include = false
        note = 'גדול מ-50MB — העלה כקישור'
      } else if (f.size > LARGE_LIMIT && !isAdmin) {
        include = false
        note = 'גדול מ-25MB — דורש אישור מנהל, העלה אותו בנפרד'
      } else if (known.has(`${f.name}|${f.size}`)) {
        include = false
        note = 'כבר קיים בספרייה'
      } else if (hashes.has(f)) {
        const h = hashes.get(f)!
        if (seen.has(h)) {
          include = false
          note = `כפילות של "${seen.get(h)}"`
        } else seen.set(h, f.name)
      }
      return {
        file: f,
        path,
        title: titleOf(f.name),
        procedureId: guessProcedure(folders, procedures.data ?? []),
        categoryId: guessCategory(f.name, categories.data ?? []),
        include,
        note,
      }
    })
    setRows(out.sort((a, b) => a.path.localeCompare(b.path)))
    setBusy('')
  }

  async function upload() {
    setError('')
    const todo = rows.filter((r) => r.include)
    try {
      for (const [i, r] of todo.entries()) {
        setBusy(`מעלה ${i + 1} מתוך ${todo.length}: ${r.title}`)
        await save.mutateAsync({
          title: r.title.trim() || titleOf(r.file.name),
          description: '',
          categoryId: r.categoryId || null,
          procedureIds: r.procedureId ? [r.procedureId] : [],
          tags: [],
          kind: 'file',
          url: '',
          file: r.file,
        })
      }
      onClose()
    } catch (e) {
      setBusy('')
      setError(e instanceof Error ? e.message : 'ההעלאה נכשלה')
    }
  }

  const count = rows.filter((r) => r.include).length

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="ייבוא תיקייה של מסמכים" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          בחר תיקייה (למשל <b>Data</b>) שמחולקת לתיקיות משנה כמו <span dir="ltr">Knee / Hip</span> ו-
          <span dir="ltr">Mako / Manual</span>. המערכת תשייך כל קובץ לפרוצדורה לפי שמות התיקיות, ותנחש קטגוריה לפי שם הקובץ.
          תוכל לתקן הכול לפני ההעלאה. עובד במחשב (לא בטלפון).
        </p>

        <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={!!busy}>
          <FolderUp size={16} />
          {rows.length ? 'בחר תיקייה אחרת' : 'בחר תיקייה'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          {...({ webkitdirectory: '' } as object)}
          onChange={(e) => {
            onPick(e.target.files)
            e.target.value = ''
          }}
        />
        {skipped > 0 && <p className="text-xs text-slate-400">{skipped} קבצים שאינם מסמכים דולגו.</p>}

        {rows.length > 0 && (
          <div tabIndex={0} className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-right text-slate-500">
                  <th className="p-2" />
                  <th className="p-2 font-medium">שם המסמך</th>
                  <th className="p-2 font-medium">פרוצדורה</th>
                  <th className="p-2 font-medium">קטגוריה</th>
                  <th className="p-2 font-medium">גודל</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.path} className={classNames('border-b border-slate-100 align-top', !r.include && 'bg-slate-50/70 text-slate-400')}>
                    <td className="p-2">
                      <input type="checkbox" className="h-4 w-4" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} />
                    </td>
                    <td className="p-2">
                      <input dir="auto" className="input !py-1" value={r.title} onChange={(e) => patch(i, { title: e.target.value })} />
                      <span dir="ltr" className="mt-0.5 block text-left text-[11px] text-slate-400">
                        {r.path}
                      </span>
                      {r.note && <span className="block text-xs text-amber-600">{r.note}</span>}
                    </td>
                    <td className="p-2">
                      <select className="input !py-1" value={r.procedureId} onChange={(e) => patch(i, { procedureId: e.target.value })}>
                        <option value="">כללי</option>
                        {(procedures.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select className="input !py-1" value={r.categoryId} onChange={(e) => patch(i, { categoryId: e.target.value })}>
                        <option value="">ללא קטגוריה</option>
                        {(categories.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap p-2 text-xs">{mb(r.file.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          {busy && <span className="ml-auto text-sm text-slate-500">{busy}</span>}
          <button className="btn-secondary" onClick={onClose} disabled={!!busy}>
            ביטול
          </button>
          <button className="btn-primary" onClick={upload} disabled={!!busy || count === 0}>
            העלה {count > 0 ? `${count} מסמכים` : ''}
          </button>
        </div>
      </div>
    </Modal>
  )
}
