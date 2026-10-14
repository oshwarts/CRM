import { useState } from 'react'
import { useConsumableItems } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { useConsumableUsage, useSaveUsage } from '../lib/forecastApi'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { Spinner } from './ui'

const TYPES = ['knee', 'uni', 'hip'] as const

/** how many units of each consumable one surgery uses, per procedure type — feeds the stock forecast */
export function ConsumableUsageEditor() {
  const { isAdmin } = useAuth()
  const items = useConsumableItems()
  const usage = useConsumableUsage()
  const save = useSaveUsage()
  const [edits, setEdits] = useState<Record<string, string>>({})
  if (items.isLoading || usage.isLoading) return <Spinner />
  const current = (item: string, t: string) => usage.data?.find((u) => u.item_id === item && u.procedure_type === t)?.qty_per_case ?? 0

  return (
    <div className="card p-4">
      <h3 className="mb-1 font-semibold text-slate-800">צריכה לניתוח (לתחזית מלאי)</h3>
      <p className="mb-3 text-sm text-slate-400">
        כמה יחידות מכל פריט נצרכות בניתוח אחד, לפי סוג הניתוח. עמוד המתכלים משתמש בזה יחד עם הניתוחים המתוכננים בסריקות כדי להתריע על מה שיחסר. פריט שלא הוגדרה לו צריכה לא נכנס לתחזית.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
              <th className="py-1.5 font-medium">פריט</th>
              {TYPES.map((t) => (
                <th key={t} className="w-20 py-1.5 text-center font-medium">
                  {SCAN_PROCEDURE_LABELS[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(items.data ?? []).map((i) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td dir="ltr" className="py-1 text-left text-slate-800 [overflow-wrap:anywhere]">
                  {i.name}
                </td>
                {TYPES.map((t) => {
                  const k = `${i.id}:${t}`
                  return (
                    <td key={t} className="py-1 text-center">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        disabled={!isAdmin}
                        className="input !w-16 !px-1 !py-1 text-center"
                        value={edits[k] ?? (current(i.id, t) || '')}
                        onChange={(e) => setEdits((m) => ({ ...m, [k]: e.target.value }))}
                        onBlur={() => {
                          if (edits[k] === undefined) return
                          const n = Math.max(0, Number(edits[k]) || 0)
                          if (n !== current(i.id, t)) save.mutate({ item_id: i.id, procedure_type: t, qty_per_case: n })
                          setEdits((m) => Object.fromEntries(Object.entries(m).filter(([key]) => key !== k)))
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isAdmin && <p className="mt-2 text-xs text-amber-600">רק מנהל יכול לשנות את הצריכה.</p>}
    </div>
  )
}
