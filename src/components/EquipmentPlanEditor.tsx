import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useDeleteDoctorEquipment,
  useDoctorEquipment,
  useEquipmentItems,
  useUpsertDoctorEquipment,
} from '../lib/api'
import { ConfirmButton, EmptyState, Spinner } from './ui'
import { Link } from 'react-router-dom'

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
        hint="הוסף הליכים בטאב 'הליכים' כדי להגדיר את הציוד הנדרש לכל אחד"
      />
    )

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        לכל הליך – רשימת הציוד הנדרש. סמן ✓ בעמודת "לפי כמות" לפריטים שכמותם
        גדלה עם מספר הניתוחים (שתלים, חד־פעמי); בטל את הסימון לפריט בכמות קבועה
        (מגש מכשירים).
      </p>

      {catalog.data && catalog.data.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          קטלוג הציוד ריק.{' '}
          <Link to="/settings" className="font-medium underline">
            הוסף פריטים בהגדרות → ציוד
          </Link>
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
        />
      ))}
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
}) {
  const [toAdd, setToAdd] = useState('')
  const usedItemIds = rows.map((r) => r.item_id)
  const available = catalog.filter((c) => !usedItemIds.includes(c.id))

  return (
    <div className="card p-4">
      <p className="mb-2 font-semibold text-slate-800">{procedure.name}</p>

      {rows.length === 0 ? (
        <p className="mb-2 text-sm text-slate-400">לא הוגדר ציוד להליך זה</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead>
              <tr className="text-slate-400">
                <th className="p-1.5 text-right font-medium">פריט</th>
                <th className="p-1.5 text-center font-medium">מק״ט</th>
                <th className="p-1.5 text-center font-medium">כמות לניתוח</th>
                <th className="p-1.5 text-center font-medium">לפי כמות</th>
                <th className="p-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-1.5 text-slate-700">
                    {r.item?.name}
                    {r.item?.company?.name && (
                      <span className="mr-1 text-xs text-slate-400">
                        {r.item.company.name}
                      </span>
                    )}
                  </td>
                  <td className="p-1.5 text-center text-xs text-slate-400" dir="ltr">
                    {r.item?.catalog_number || '—'}
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="number"
                      min={1}
                      className="input w-16 py-1 text-center"
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
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
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
                  </td>
                  <td className="p-1.5 text-center">
                    <ConfirmButton
                      className="btn-ghost !px-2 text-red-500"
                      onConfirm={() => onDelete(r.id)}
                    >
                      <Trash2 size={14} />
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <select
          className="input"
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
    </div>
  )
}
