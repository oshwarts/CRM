import { useEffect, useRef, useState } from 'react'
import { Camera, Plus, Trash2 } from 'lucide-react'
import { findDefaultCompany, shrinkImage, useCompanies, useEquipmentImageUrl, useSaveEquipmentItem, type EquipmentPartInput } from '../lib/api'
import type { EquipmentItemWithCompany } from '../lib/types'
import { Field, Modal } from './ui'

/** lines such as "1 110730 End effector array" or "110730<TAB>End effector array" → parts */
function parsePasted(text: string): EquipmentPartInput[] {
  const out: EquipmentPartInput[] = []
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.replace(/\s+/g, ' ').trim()
    if (!l) continue
    let m = l.match(/^(\d{1,3})[.)]?\s+([0-9A-Z][0-9A-Z.-]{3,})\s+(.+)$/)
    if (m) {
      out.push({ position: Number(m[1]), catalog_no: m[2], description: m[3], qty: 1 })
      continue
    }
    m = l.match(/^([0-9A-Z][0-9A-Z.-]{3,})\s+(.+)$/)
    out.push(m ? { position: null, catalog_no: m[1], description: m[2], qty: 1 } : { position: null, catalog_no: '', description: l, qty: 1 })
  }
  return out
}

/** create / edit a catalog item: name, picture and the parts inside it */
export function EquipmentItemModal({ item, onClose }: { item?: EquipmentItemWithCompany | null; onClose: () => void }) {
  const companies = useCompanies()
  const save = useSaveEquipmentItem()
  const fileRef = useRef<HTMLInputElement>(null)
  const current = useEquipmentImageUrl(item?.image_path)

  const [name, setName] = useState(item?.name ?? '')
  const [catalog, setCatalog] = useState(item?.catalog_number ?? '')
  const [companyId, setCompanyId] = useState(item?.company_id ?? '')
  // a new item belongs to A.M.I. Technologies unless another company is chosen
  const defaultCompany = findDefaultCompany(companies.data)
  useEffect(() => {
    if (!item && !companyId && defaultCompany) setCompanyId(defaultCompany.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCompany?.id])
  const [parts, setParts] = useState<EquipmentPartInput[]>(
    [...(item?.parts ?? [])].sort((a, b) => a.sort - b.sort).map((p) => ({ position: p.position, catalog_no: p.catalog_no, description: p.description, qty: p.qty })),
  )
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [removeImage, setRemoveImage] = useState(false)
  const [paste, setPaste] = useState('')
  const [error, setError] = useState('')

  const shownImage = preview || (!removeImage ? current.data : '')
  const setPart = (i: number, p: Partial<EquipmentPartInput>) => setParts((x) => x.map((r, k) => (k === i ? { ...r, ...p } : r)))

  async function submit() {
    setError('')
    if (!name.trim()) return setError('כתוב שם למגש / לציוד')
    try {
      await save.mutateAsync({
        id: item?.id,
        name,
        catalog_number: catalog,
        company_id: companyId || null,
        image: file ? await shrinkImage(file) : null,
        removeImage,
        parts,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? 'עריכת ציוד' : 'ציוד חדש'} size="xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="שם הציוד / המגש" className="sm:col-span-2">
            <input className="input" dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: Knee array / balancing instrument kit — Upper tray" autoFocus />
          </Field>
          <Field label="מק״ט המגש (אם יש)">
            <input className="input text-right" dir="ltr" value={catalog} onChange={(e) => setCatalog(e.target.value)} />
          </Field>
          <Field label="חברה">
            <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">—</option>
              {(companies.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <span className="label">תמונה של הציוד</span>
          <div className="flex flex-wrap items-start gap-3">
            {shownImage && <img src={shownImage} alt="" className="max-h-48 rounded-lg border border-slate-200" />}
            <div className="space-y-2">
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                <Camera size={16} />
                {shownImage ? 'החלף תמונה' : 'צלם / בחר תמונה'}
              </button>
              {(shownImage || item?.image_path) && !preview && !removeImage && (
                <button type="button" className="btn-ghost block text-red-500" onClick={() => setRemoveImage(true)}>
                  הסר תמונה
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  setRemoveImage(false)
                  setPreview(f ? URL.createObjectURL(f) : '')
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <span className="label">מק״טים שנמצאים בציוד ({parts.length})</span>
          {parts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-xs text-slate-400">
                    <th className="w-14 p-1 text-center font-medium">#</th>
                    <th className="w-36 p-1 text-center font-medium">מק״ט</th>
                    <th className="p-1 text-right font-medium">תיאור</th>
                    <th className="w-16 p-1 text-center font-medium">כמות</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, i) => (
                    <tr key={i}>
                      <td className="p-1">
                        <input type="number" min={1} className="input !py-1 text-center" value={p.position ?? ''} onChange={(e) => setPart(i, { position: e.target.value ? Number(e.target.value) : null })} />
                      </td>
                      <td className="p-1">
                        <input className="input !py-1 text-center font-mono" dir="ltr" value={p.catalog_no} onChange={(e) => setPart(i, { catalog_no: e.target.value })} />
                      </td>
                      <td className="p-1">
                        <input className="input !py-1" dir="auto" value={p.description} onChange={(e) => setPart(i, { description: e.target.value })} />
                      </td>
                      <td className="p-1">
                        <input type="number" min={1} className="input !py-1 text-center" value={p.qty} onChange={(e) => setPart(i, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                      </td>
                      <td className="p-1">
                        <button type="button" className="btn-ghost !px-1.5 text-red-500" onClick={() => setParts((x) => x.filter((_, k) => k !== i))} aria-label="הסר שורה">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" className="btn-ghost mt-1" onClick={() => setParts((x) => [...x, { position: x.length + 1, catalog_no: '', description: '', qty: 1 }])}>
            <Plus size={16} />
            הוסף מק״ט
          </button>

          <details className="mt-2 rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-600">הדבקת רשימה (מהירה)</summary>
            <p className="mt-2 text-xs text-slate-500">שורה לכל פריט: מספר, מק״ט ותיאור (למשל "1 110730 End effector array"), או רק מק״ט ותיאור. אפשר להדביק מ-Excel או מ-Word.</p>
            <textarea className="input mt-2 min-h-24 font-mono text-xs" dir="ltr" value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button
              type="button"
              className="btn-secondary mt-2"
              disabled={!paste.trim()}
              onClick={() => {
                setParts((x) => [...x, ...parsePasted(paste)])
                setPaste('')
              }}
            >
              הוסף לרשימה
            </button>
          </details>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
