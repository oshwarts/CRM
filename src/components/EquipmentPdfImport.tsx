import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { findDefaultCompany, useCompanies, useEquipmentItems, useSaveEquipmentItem } from '../lib/api'
import { readTrayPdf, type TrayDraft } from '../lib/trayPdf'
import { Modal } from './ui'

type Row = TrayDraft & { include: boolean }

/** takes a tray-layout PDF and creates one equipment item per page: name, parts list and the page picture */
export function EquipmentPdfImport({ onClose }: { onClose: () => void }) {
  const companies = useCompanies()
  const existing = useEquipmentItems()
  const save = useSaveEquipmentItem()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [companyId, setCompanyId] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const names = new Set((existing.data ?? []).map((e) => e.name.toLowerCase()))

  async function pick(file: File | undefined) {
    if (!file) return
    setError('')
    setRows([])
    setBusy('פותח את הקובץ…')
    try {
      const drafts = await readTrayPdf(file, setBusy)
      if (!drafts.length) setError('לא נמצאו בקובץ רשימות מק״טים (שורות בצורה "1 110730 תיאור").')
      setRows(drafts.map((d) => ({ ...d, include: !names.has(d.name.toLowerCase()) })))
      const own = findDefaultCompany(companies.data)
      if (own && !companyId) setCompanyId(own.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'קריאת הקובץ נכשלה')
    } finally {
      setBusy('')
    }
  }

  async function create() {
    setError('')
    const todo = rows.filter((r) => r.include && r.name.trim())
    try {
      for (const [i, r] of todo.entries()) {
        setBusy(`שומר ${i + 1} מתוך ${todo.length}: ${r.name}`)
        await save.mutateAsync({ name: r.name, catalog_number: '', company_id: companyId || null, images: [], parts: r.parts })
      }
      onClose()
    } catch (e) {
      setBusy('')
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  const count = rows.filter((r) => r.include).length

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="ייבוא מגשים מקובץ PDF" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          בחר קובץ PDF של פריסת מגשים (למשל "Mako Knee tray"). כל עמוד שיש בו רשימת מק״טים הופך לפריט ציוד: שם ורשימת מק״טים.
          את התמונה של כל מגש מוסיפים אחר כך (צילום או קובץ) בעריכת הפריט. אפשר לתקן הכול לפני השמירה.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <FileUp size={16} />
            {rows.length ? 'בחר קובץ אחר' : 'בחר קובץ PDF'}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          <select className="input !w-auto" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="חברה">
            <option value="">חברה: ללא</option>
            {(companies.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.page} className={`rounded-xl border p-3 ${r.include ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-2 h-5 w-5" checked={r.include} onChange={(e) => patch(i, { include: e.target.checked })} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input className="input" dir="auto" value={r.name} onChange={(e) => patch(i, { name: e.target.value })} />
                    {names.has(r.name.toLowerCase()) && <p className="text-xs text-amber-600">פריט בשם זה כבר קיים בקטלוג</p>}
                    <p className="text-xs text-slate-500">
                      עמוד {r.page} · {r.parts.length} מק״טים: {r.parts.slice(0, 4).map((p) => p.catalog_no).join(', ')}
                      {r.parts.length > 4 ? '…' : ''}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          {busy && <span className="ml-auto text-sm text-slate-500">{busy}</span>}
          <button className="btn-secondary" onClick={onClose} disabled={!!busy}>
            ביטול
          </button>
          <button className="btn-primary" onClick={create} disabled={!!busy || count === 0}>
            צור {count > 0 ? `${count} פריטי ציוד` : ''}
          </button>
        </div>
      </div>
    </Modal>
  )
}
