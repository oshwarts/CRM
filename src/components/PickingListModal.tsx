import { useMemo, useState } from 'react'
import { Download, Plus, Printer, Trash2 } from 'lucide-react'
import { useDoctorEquipment } from '../lib/api'
import { EmptyState, Modal, Spinner } from './ui'

type Line = { procedure_id: string; count: number }

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
  const [lines, setLines] = useState<Line[]>([])

  // procedures that have equipment defined
  const procedures = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of equipment.data ?? [])
      if (r.procedure) m.set(r.procedure.id, r.procedure.name)
    return [...m.entries()].map(([id, name]) => ({ id, name }))
  }, [equipment.data])

  const totals = useMemo(() => {
    // item_id -> { name, catalog, company, perCase parts, total }
    const map = new Map<
      string,
      { name: string; catalog: string; company: string; total: number; detail: string[] }
    >()
    for (const line of lines) {
      if (!line.procedure_id || line.count <= 0) continue
      for (const r of equipment.data ?? []) {
        if (r.procedure_id !== line.procedure_id || !r.item) continue
        const add = r.scales_with_cases
          ? r.qty_per_case * line.count
          : r.qty_per_case
        const cur =
          map.get(r.item_id) ?? {
            name: r.item.name,
            catalog: r.item.catalog_number,
            company: r.item.company?.name ?? '',
            total: 0,
            detail: [],
          }
        cur.total += add
        cur.detail.push(
          r.scales_with_cases
            ? `${r.qty_per_case}×${line.count}`
            : `${r.qty_per_case} (קבוע)`,
        )
        map.set(r.item_id, cur)
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'))
  }, [lines, equipment.data])

  function csv() {
    const rows = [
      ['פריט', 'מק״ט', 'חברה', 'סה״כ'],
      ...totals.map((t) => [t.name, t.catalog, t.company, t.total]),
    ]
    const body = rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v)
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(','),
      )
      .join('\n')
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ליקוט-${doctorName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open onClose={onClose} title={`רשימת ליקוט – ${doctorName}`} size="xl">
      {equipment.isLoading ? (
        <Spinner />
      ) : procedures.length === 0 ? (
        <EmptyState
          title="לא הוגדר ציוד לרופא זה"
          hint="הגדר ציוד בטאב 'ציוד לניתוח' בכרטיס הרופא"
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className="input"
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
                  min={1}
                  className="input w-24 text-center"
                  placeholder="כמות"
                  value={line.count || ''}
                  onChange={(e) => {
                    const next = [...lines]
                    next[i] = {
                      ...line,
                      count: Math.max(0, Number(e.target.value) || 0),
                    }
                    setLines(next)
                  }}
                />
                <button
                  className="btn-ghost !px-2 text-red-500"
                  onClick={() => setLines(lines.filter((_, x) => x !== i))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="btn-secondary"
              onClick={() =>
                setLines([...lines, { procedure_id: '', count: 1 }])
              }
            >
              <Plus size={16} />
              הוסף ניתוח
            </button>
          </div>

          {totals.length > 0 && (
            <div id="picking-print" className="card overflow-x-auto">
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
                    <tr key={t.name} className="border-b border-slate-100">
                      <td className="p-2 text-slate-700">{t.name}</td>
                      <td className="p-2 text-center text-xs text-slate-400" dir="ltr">
                        {t.catalog || '—'}
                      </td>
                      <td className="p-2 text-center text-slate-500">
                        {t.company || '—'}
                      </td>
                      <td className="p-2 text-center text-xs text-slate-400" dir="ltr">
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
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={16} />
                הדפסה
              </button>
              <button className="btn-secondary" onClick={csv}>
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
