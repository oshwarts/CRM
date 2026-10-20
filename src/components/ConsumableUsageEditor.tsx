import { useState } from 'react'
import { useConsumableItems } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { useConsumableUsage, useSaveUsage } from '../lib/forecastApi'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { Spinner } from './ui'
import { Section } from './SettingsKit'

const TYPES = ['knee', 'uni', 'hip'] as const

/** how many units of each consumable one surgery uses, per procedure type — feeds the stock forecast */
export function ConsumableUsageEditor() {
  const { isAdmin } = useAuth()
  const items = useConsumableItems()
  const usage = useConsumableUsage()
  const save = useSaveUsage()
  const [edits, setEdits] = useState<Record<string, string>>({})
  const current = (item: string, t: string) => usage.data?.find((u) => u.item_id === item && u.procedure_type === t)?.qty_per_case ?? 0

  return (
    <Section title="צריכה לניתוח (לתחזית מלאי)" hint="כמה יחידות מכל פריט נצרכות בניתוח אחד">
      {items.isLoading || usage.isLoading ? (
        <Spinner />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            כמה יחידות מכל פריט נצרכות בניתוח אחד, לפי סוג הניתוח. עמוד המתכלים משתמש בזה יחד עם הניתוחים המתוכננים בסריקות כדי להתריע על מה שיחסר. פריט שלא הוגדרה לו צריכה לא נכנס לתחזית.
          </p>
          <ul className="divide-y divide-slate-100">
            {(items.data ?? []).map((i) => (
              <li key={i.id} className="py-2">
                <p dir="ltr" className="mb-1.5 text-left text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">
                  {i.name}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => {
                    const k = `${i.id}:${t}`
                    return (
                      <label key={t} className="block text-center">
                        <span className="mb-0.5 block text-xs text-slate-500">{SCAN_PROCEDURE_LABELS[t]}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          disabled={!isAdmin}
                          className="input text-center"
                          value={edits[k] ?? (current(i.id, t) || '')}
                          onChange={(e) => setEdits((m) => ({ ...m, [k]: e.target.value }))}
                          onBlur={() => {
                            if (edits[k] === undefined) return
                            const n = Math.max(0, Number(edits[k]) || 0)
                            if (n !== current(i.id, t)) save.mutate({ item_id: i.id, procedure_type: t, qty_per_case: n })
                            setEdits((m) => Object.fromEntries(Object.entries(m).filter(([key]) => key !== k)))
                          }}
                        />
                      </label>
                    )
                  })}
                </div>
              </li>
            ))}
            {(items.data ?? []).length === 0 && <li className="py-4 text-center text-sm text-slate-500">אין פריטים. הוסף פריטי מתכלים קודם.</li>}
          </ul>
          {!isAdmin && <p className="mt-2 text-xs text-amber-700">רק מנהל יכול לשנות את הצריכה.</p>}
        </>
      )}
    </Section>
  )
}
