import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Plus, Trash2, X } from 'lucide-react'
import { findDefaultCompany, shrinkImage, useCompanies, useEquipmentImageUrl, useSaveEquipmentItem, type EquipmentPartInput } from '../lib/api'
import { itemImages, type EquipmentItemWithCompany } from '../lib/types'
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

type Pic = { id: string; path?: string; blob?: Blob; url?: string; label: string }
const PIC_LABELS = ['מגש עליון', 'מגש תחתון']

/** a picture of the item: a stored one (private link) or a new one still on this device */
function PicTile({ pic, index, total, onLabel, onMove, onRemove }: { pic: Pic; index: number; total: number; onLabel: (v: string) => void; onMove: (by: number) => void; onRemove: () => void }) {
  const stored = useEquipmentImageUrl(pic.path)
  const src = pic.url ?? stored.data
  return (
    <div className="w-36 space-y-1 rounded-xl border border-slate-200 p-1.5">
      <div className="relative">
        {src ? <img src={src} alt="" className="h-28 w-full rounded-lg object-cover" /> : <div className="h-28 w-full animate-pulse rounded-lg bg-slate-100" />}
        <button type="button" className="absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-white" onClick={onRemove} aria-label="הסר תמונה">
          <X size={12} />
        </button>
      </div>
      <input className="input !py-1 text-xs" dir="auto" list="eq-pic-labels" placeholder="שם (למשל מגש עליון)" value={pic.label} onChange={(e) => onLabel(e.target.value)} />
      <div className="flex justify-between">
        <button type="button" className="btn-ghost !px-1.5 !py-0.5 disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label="הקדם">
          <ArrowRight size={14} />
        </button>
        <button type="button" className="btn-ghost !px-1.5 !py-0.5 disabled:opacity-30" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="אחר">
          <ArrowLeft size={14} />
        </button>
      </div>
    </div>
  )
}

/** create / edit a catalog item: name, pictures (a set can be two trays) and the parts inside it */
export function EquipmentItemModal({ item, onClose }: { item?: EquipmentItemWithCompany | null; onClose: () => void }) {
  const companies = useCompanies()
  const save = useSaveEquipmentItem()
  const fileRef = useRef<HTMLInputElement>(null)

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
  const [pics, setPics] = useState<Pic[]>(() => (item ? itemImages(item) : []).map((im) => ({ id: im.path, path: im.path, label: im.label })))
  const [paste, setPaste] = useState('')
  const [error, setError] = useState('')

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
        images: pics.map((x) => ({ path: x.path, blob: x.blob, label: x.label })),
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
          <span className="label">תמונות של הציוד ({pics.length})</span>
          <p className="mb-2 text-xs text-slate-400">ציוד שמורכב משני מגשים (עליון ותחתון) — העלה תמונה לכל מגש ותן לכל אחת שם.</p>
          <div className="flex flex-wrap items-start gap-2">
            {pics.map((pic, i) => (
              <PicTile
                key={pic.id}
                pic={pic}
                index={i}
                total={pics.length}
                onLabel={(v) => setPics((x) => x.map((y) => (y.id === pic.id ? { ...y, label: v } : y)))}
                onMove={(by) =>
                  setPics((x) => {
                    const j = i + by
                    if (j < 0 || j >= x.length) return x
                    const n = [...x]
                    ;[n[i], n[j]] = [n[j], n[i]]
                    return n
                  })
                }
                onRemove={() => setPics((x) => x.filter((y) => y.id !== pic.id))}
              />
            ))}
            <button type="button" className="grid h-[9.5rem] w-36 place-items-center rounded-xl border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50" onClick={() => fileRef.current?.click()}>
              <span className="flex flex-col items-center gap-1 text-sm">
                <Camera size={22} />
                {pics.length ? 'הוסף תמונה' : 'צלם / בחר תמונה'}
              </span>
            </button>
          </div>
          <datalist id="eq-pic-labels">
            {PIC_LABELS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              const added: Pic[] = []
              for (const f of files) {
                const blob = await shrinkImage(f)
                added.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), label: '' })
              }
              setPics((x) => [...x, ...added])
            }}
          />
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
