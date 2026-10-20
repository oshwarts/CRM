import { SettingsLink } from './SettingsLink'
import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useDeleteDoctorEquipment,
  useDoctorEquipment,
  useEquipmentItems,
  useUpsertDoctorEquipment,
} from '../lib/api'
import { ConfirmButton, EmptyState, Spinner } from './ui'
import { EquipmentViewModal } from './EquipmentViewModal'
import { itemImages, type EquipmentItemWithCompany } from '../lib/types'

export function EquipmentPlanEditor({
  doctorId,
  procedures,
}: {
  doctorId: string
  procedures: { id: string; name: string }[]
}) {
  const equipment = useDoctorEquipment(doctorId)
  const catalog = useEquipmentItems()
  const upsert = useUpsertDoctorEquipment(doctorId)
  const del = useDeleteDoctorEquipment(doctorId)
  const [viewing, setViewing] = useState<EquipmentItemWithCompany | null>(null)

  const rowsByProcedure = useMemo(() => {
    const m = new Map<string, typeof equipment.data>()
    for (const r of equipment.data ?? []) {
      const arr = m.get(r.procedure_id) ?? []
      arr.push(r)
      m.set(r.procedure_id, arr)
    }
    return m
  }, [equipment.data])

  if (equipment.isLoading) return <Spinner />

  if (procedures.length === 0)
    return (
      <EmptyState
        title="בחר תחילה הליכים"
        hint="הוסף הליכים בעריכת פרטי הרופא כדי להגדיר את הציוד הנדרש לכל אחד"
      />
    )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        לכל הליך – רשימת הציוד הנדרש. סמן "לפי כמות" לפריטים שכמותם גדלה עם מספר הניתוחים (שתלים, חד־פעמי); בלי הסימון הפריט הוא בכמות קבועה (מגש מכשירים).
      </p>

      {catalog.data && catalog.data.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          קטלוג הציוד ריק.{' '}
          <SettingsLink className="font-medium underline">הוסף פריטים בהגדרות → ציוד</SettingsLink>
        </p>
      )}

      {procedures.map((p) => (
        <ProcedureEquipment
          key={p.id}
          procedure={p}
          rows={rowsByProcedure.get(p.id) ?? []}
          catalog={catalog.data ?? []}
          onAdd={(item_id) =>
            upsert.mutate({
              procedure_id: p.id,
              item_id,
              qty_per_case: 1,
              scales_with_cases: true,
            })
          }
          onUpdate={(r) => upsert.mutate(r)}
          onDelete={(id) => del.mutate(id)}
          onView={(item) => setViewing(item)}
        />
      ))}
      {viewing && <EquipmentViewModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

type Row = NonNullable<
  ReturnType<typeof useDoctorEquipment>['data']
>[number]

function ProcedureEquipment({
  procedure,
  rows,
  catalog,
  onAdd,
  onUpdate,
  onDelete,
  onView,
}: {
  procedure: { id: string; name: string }
  rows: Row[]
  catalog: { id: string; name: string; catalog_number: string }[]
  onAdd: (itemId: string) => void
  onUpdate: (r: {
    id: string
    procedure_id: string
    item_id: string
    qty_per_case: number
    scales_with_cases: boolean
  }) => void
  onDelete: (id: string) => void
  onView: (item: EquipmentItemWithCompany) => void
}) {
  const [toAdd, setToAdd] = useState('')
  const usedItemIds = rows.map((r) => r.item_id)
  const available = catalog.filter((c) => !usedItemIds.includes(c.id))

  return (
    <section className="card p-3 sm:p-4">
      <h2 className="mb-2 break-words font-semibold text-slate-800">{procedure.name}</h2>

      {rows.length === 0 ? (
        <p className="mb-2 text-sm text-slate-500">לא הוגדר ציוד להליך זה</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 py-3 first:pt-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 text-sm">
                  {r.item ? (
                    <button className="break-words text-right font-medium text-slate-800 hover:text-brand-600 hover:underline" onClick={() => onView(r.item as EquipmentItemWithCompany)}>
                      {r.item.name}
                    </button>
                  ) : null}
                  <p className="break-words text-xs text-slate-500">
                    {[
                      r.item?.catalog_number,
                      r.item?.company?.name,
                      r.item && r.item.parts?.length > 0 ? `${r.item.parts.length} מק״טים` : r.item && itemImages(r.item).length > 0 ? 'יש תמונה' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <ConfirmButton className="btn-ghost shrink-0 !px-2.5 text-red-600" onConfirm={() => onDelete(r.id)}>
                  <Trash2 size={16} />
                </ConfirmButton>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  כמות לניתוח
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="input !w-16 py-1 text-center"
                    defaultValue={r.qty_per_case}
                    onBlur={(e) => {
                      const qty = Math.max(1, Number(e.target.value) || 1)
                      if (qty !== r.qty_per_case)
                        onUpdate({
                          id: r.id,
                          procedure_id: r.procedure_id,
                          item_id: r.item_id,
                          qty_per_case: qty,
                          scales_with_cases: r.scales_with_cases,
                        })
                    }}
                  />
                </label>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={r.scales_with_cases}
                    onChange={(e) =>
                      onUpdate({
                        id: r.id,
                        procedure_id: r.procedure_id,
                        item_id: r.item_id,
                        qty_per_case: r.qty_per_case,
                        scales_with_cases: e.target.checked,
                      })
                    }
                  />
                  לפי כמות
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-2">
        <select
          className="input min-w-0 flex-1"
          aria-label={`הוספת פריט להליך ${procedure.name}`}
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value)}
        >
          <option value="">הוסף פריט מהקטלוג…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.catalog_number ? ` (${c.catalog_number})` : ''}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary shrink-0"
          disabled={!toAdd}
          onClick={() => {
            onAdd(toAdd)
            setToAdd('')
          }}
        >
          <Plus size={16} />
          הוסף
        </button>
      </div>
    </section>
  )
}
