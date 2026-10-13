import { useState } from 'react'
import { Check, Copy, ImageOff, Search, X } from 'lucide-react'
import { useEquipmentImageUrl } from '../lib/api'
import type { EquipmentItemWithCompany } from '../lib/types'
import { Modal, Spinner } from './ui'

/** a tray in a comfortable view: the picture (tap to enlarge) and the parts inside it, searchable and copyable */
export function EquipmentViewModal({ item, onClose }: { item: EquipmentItemWithCompany; onClose: () => void }) {
  const img = useEquipmentImageUrl(item.image_path)
  const [q, setQ] = useState('')
  const [zoom, setZoom] = useState(false)
  const [copied, setCopied] = useState(false)

  const parts = [...(item.parts ?? [])].sort((a, b) => a.sort - b.sort)
  const needle = q.trim().toLowerCase()
  const shown = needle ? parts.filter((p) => `${p.catalog_no} ${p.description} ${p.position ?? ''}`.toLowerCase().includes(needle)) : parts

  async function copyList() {
    const text = parts.map((p) => [p.position ?? '', p.catalog_no, p.description, p.qty > 1 ? `x${p.qty}` : ''].filter((x) => x !== '').join('\t')).join('\n')
    try {
      await navigator.clipboard.writeText(`${item.name}\n${text}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('העתק את הרשימה:', text)
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title={item.name} size="xl">
        <div className="space-y-4">
          <p className="text-sm text-slate-500" dir="auto">
            {[item.company?.name, item.catalog_number && `מק״ט ${item.catalog_number}`, parts.length ? `${parts.length} פריטים במגש` : ''].filter(Boolean).join(' · ')}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              {!item.image_path ? (
                <div className="grid h-48 place-items-center rounded-xl border border-dashed border-slate-300 text-slate-400">
                  <span className="flex items-center gap-2 text-sm">
                    <ImageOff size={18} /> לא הועלתה תמונה
                  </span>
                </div>
              ) : img.isLoading ? (
                <Spinner />
              ) : img.data ? (
                <button type="button" className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white" onClick={() => setZoom(true)} aria-label="הגדל תמונה">
                  <img src={img.data} alt={item.name} className="mx-auto max-h-[70vh] w-full object-contain" />
                  <span className="block bg-slate-50 py-1 text-center text-xs text-slate-400">לחץ להגדלה</span>
                </button>
              ) : (
                <p className="text-sm text-red-500">טעינת התמונה נכשלה (נדרש חיבור לרשת)</p>
              )}
            </div>

            <div className="min-w-0">
              {parts.length === 0 ? (
                <p className="text-sm text-slate-400">לא נרשמו מק״טים למגש זה.</p>
              ) : (
                <>
                  <div className="mb-2 flex gap-2">
                    <label className="relative block flex-1">
                      <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="search" className="input !py-1.5 !pr-9" placeholder="חיפוש מק״ט או תיאור…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </label>
                    <button className="btn-secondary shrink-0" onClick={copyList}>
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                      {copied ? 'הועתק' : 'העתק רשימה'}
                    </button>
                  </div>
                  <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="p-2 text-center font-medium">#</th>
                          <th className="p-2 text-center font-medium">מק״ט</th>
                          <th className="p-2 text-right font-medium">תיאור</th>
                          <th className="p-2 text-center font-medium">כמות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((p) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="p-2 text-center text-slate-400">{p.position ?? ''}</td>
                            <td className="p-2 text-center font-mono text-xs" dir="ltr">
                              {p.catalog_no}
                            </td>
                            <td className="p-2 text-slate-700" dir="auto">
                              {p.description}
                            </td>
                            <td className="p-2 text-center text-slate-500">{p.qty > 1 ? p.qty : ''}</td>
                          </tr>
                        ))}
                        {shown.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400">
                              לא נמצאו פריטים
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {zoom && img.data && (
        <div className="fixed inset-0 z-[60] overflow-auto bg-black/90" onClick={() => setZoom(false)}>
          <button className="fixed right-3 top-3 z-10 rounded-full bg-white/90 p-2" aria-label="סגור" onClick={() => setZoom(false)}>
            <X size={20} />
          </button>
          {/* the picture can be scrolled and pinch-zoomed on a phone */}
          <img src={img.data} alt={item.name} className="mx-auto min-h-full w-auto min-w-full max-w-none object-contain sm:min-w-0 sm:max-w-full" />
        </div>
      )}
    </>
  )
}
