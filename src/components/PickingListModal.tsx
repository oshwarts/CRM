import { useMemo, useState } from 'react'
import { Download, Plus, Printer, Trash2 } from 'lucide-react'
import { useDoctorEquipment } from '../lib/api'
import { pickingTotals, type PickingLine } from '../lib/picking'
import { EmptyState, Modal, Spinner } from './ui'
import { csvCell, formatDate, todayISO } from '../lib/utils'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function PickingListModal({
  doctorId,
  doctorName,
  onClose,
}: {
  doctorId: string
  doctorName: string
  onClose: () => void
}) {
  const equipment = useDoctorEquipment(doctorId)
  // null = the agent did not touch the lines yet: one line for the first procedure, so that the list is there at once
  const [edited, setEdited] = useState<PickingLine[] | null>(null)

  // procedures that have equipment defined
  const procedures = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of equipment.data ?? [])
      if (r.procedure) m.set(r.procedure.id, r.procedure.name)
    return [...m.entries()].map(([id, name]) => ({ id, name }))
  }, [equipment.data])

  const lines: PickingLine[] = useMemo(() => edited ?? (procedures[0] ? [{ procedure_id: procedures[0].id, count: 1 }] : []), [edited, procedures])
  const setLines = (l: PickingLine[]) => setEdited(l)

  const totals = useMemo(() => pickingTotals(equipment.data ?? [], lines), [lines, equipment.data])

  const title = `ליקוט – ${doctorName}`
  const fileName = `ליקוט-${doctorName}`.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim()

  function csv() {
    const rows = [
      ['פריט', 'מק״ט', 'חברה', 'סה״כ'],
      ...totals.map((t) => [t.name, t.catalog, t.company, t.total]),
    ]
    const body = rows
      .map((r) =>
        r.map(csvCell).join(','),
      )
      .join('\n')
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** prints just the list (in a hidden frame), not the page behind the dialog */
  function print() {
    const surgeries = lines
      .filter((l) => l.procedure_id && l.count > 0)
      .map((l) => `${procedures.find((p) => p.id === l.procedure_id)?.name ?? ''} × ${l.count}`)
      .join(' · ')
    const rows = totals
      .map((t) => `<tr><td>${esc(t.name)}</td><td dir="ltr">${esc(t.catalog || '—')}</td><td>${esc(t.company || '—')}</td><td dir="ltr">${esc(t.detail.join(' + '))}</td><td class="n">${t.total}</td></tr>`)
      .join('')
    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:Arial,sans-serif;margin:16px;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#444;font-size:13px}
@page{size:A4;margin:12mm}table{width:100%;border-collapse:collapse;font-size:14px}tr{break-inside:avoid}th,td{border:1px solid #999;padding:6px 8px;text-align:right}th,td:nth-child(2),td:nth-child(4),td.n{white-space:nowrap}td:first-child{overflow-wrap:anywhere}td:nth-child(3){overflow-wrap:break-word}th{background:#eee}td.n{font-size:18px;font-weight:bold;text-align:center}
</style></head><body><h1>${esc(title)}</h1><p>${esc(surgeries)} · ${formatDate(todayISO())}</p>
<table><thead><tr><th>פריט</th><th>מק״ט</th><th>חברה</th><th>חישוב</th><th>סה״כ לשלוח</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(frame)
    const w = frame.contentWindow
    if (!w) return frame.remove()
    w.document.open()
    w.document.write(html)
    w.document.close()
    const done = () => frame.remove()
    w.addEventListener('afterprint', done)
    setTimeout(done, 60_000) // a browser that never reports the end of printing
    w.focus()
    w.print()
  }

  return (
    <Modal open onClose={onClose} title={title} size="xl">
      {equipment.isLoading ? (
        <Spinner />
      ) : procedures.length === 0 ? (
        <EmptyState
          title="לא הוגדר ציוד לרופא זה"
          hint="הגדר ציוד בטאב 'ציוד' בכרטיס הרופא"
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className="input min-w-0 flex-1"
                  aria-label={`ניתוח ${i + 1}`}
                  value={line.procedure_id}
                  onChange={(e) => {
                    const next = [...lines]
                    next[i] = { ...line, procedure_id: e.target.value }
                    setLines(next)
                  }}
                >
                  <option value="">בחר ניתוח…</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  className="input w-20 shrink-0 text-center"
                  placeholder="כמות"
                  aria-label={`מספר ניתוחים בשורה ${i + 1}`}
                  value={line.count || ''}
                  onChange={(e) => {
                    const next = [...lines]
                    next[i] = {
                      ...line,
                      count: Math.min(999, Math.max(0, Math.floor(Number(e.target.value)) || 0)),
                    }
                    setLines(next)
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost shrink-0 !px-2.5 text-red-600"
                  aria-label={`הסר את שורה ${i + 1}`}
                  onClick={() => setLines(lines.filter((_, x) => x !== i))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setLines([...lines, { procedure_id: '', count: 1 }])
              }
            >
              <Plus size={16} />
              הוסף ניתוח
            </button>
          </div>

          {totals.length === 0 && <p className="text-sm text-slate-500">בחר ניתוח וכמות כדי לראות מה לשלוח.</p>}

          {totals.length > 0 && (
            <div id="picking-print" tabIndex={0} role="region" aria-label="רשימת הליקוט" className="card overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-2 text-right font-medium">פריט</th>
                    <th className="p-2 text-center font-medium">מק״ט</th>
                    <th className="p-2 text-center font-medium">חברה</th>
                    <th className="p-2 text-center font-medium">חישוב</th>
                    <th className="p-2 text-center font-semibold">סה״כ לשלוח</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((t) => (
                    <tr key={t.itemId} className="border-b border-slate-100">
                      <td className="p-2 text-slate-700">{t.name}</td>
                      <td className="p-2 text-center text-xs text-slate-500" dir="ltr">
                        {t.catalog || '—'}
                      </td>
                      <td className="p-2 text-center text-slate-500">
                        {t.company || '—'}
                      </td>
                      <td className="p-2 text-center text-xs text-slate-500" dir="ltr">
                        {t.detail.join(' + ')}
                      </td>
                      <td className="p-2 text-center text-lg font-bold text-slate-800">
                        {t.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totals.length > 0 && (
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={print}>
                <Printer size={16} />
                הדפסה
              </button>
              <button type="button" className="btn-secondary" onClick={csv}>
                <Download size={16} />
                ייצוא CSV
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
