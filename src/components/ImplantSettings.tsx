import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Link2, Plus, Trash2 } from 'lucide-react'
import {
  useDeleteImplantField,
  useDeleteImplantOption,
  useImplantFields,
  useImplantOptions,
  useReorderImplantFields,
  useReorderImplantOptions,
  useSaveImplantField,
  useUpsertImplantOption,
} from '../lib/api'
import { generalOptions, implantFieldsOf, type ImplantFieldDef } from '../lib/implants'
import { IMPLANT_FIELDS, SCAN_PROCEDURE_LABELS, type ImplantField, type ImplantOption } from '../lib/types'
import { classNames } from '../lib/utils'
import { Spinner } from './ui'

const message = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  return m.includes('duplicate') || m.includes('unique') ? 'הערך כבר קיים ברשימה' : m || 'הפעולה נכשלה'
}

/** one list of sizes: every value can be renamed, moved, deleted; new values are typed (several at once with commas) */
function OptionList({ category, parentId, options, placeholder }: { category: string; parentId: string | null; options: ImplantOption[]; placeholder: string }) {
  const upsert = useUpsertImplantOption()
  const del = useDeleteImplantOption()
  const reorder = useReorderImplantOptions()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [error, setError] = useState('')

  const list = useMemo(
    () =>
      options
        .filter((o) => o.category === category && (o.parent_id ?? null) === parentId)
        .sort((a, b) => a.sort - b.sort || a.value.localeCompare(b.value, 'he', { numeric: true })),
    [options, category, parentId],
  )

  async function add() {
    const values = draft.split(/[,\n،]+/).map((v) => v.trim()).filter(Boolean)
    if (!values.length) return
    setError('')
    try {
      let sort = Math.max(0, ...list.map((o) => o.sort))
      for (const v of values) if (!list.some((o) => o.value === v)) await upsert.mutateAsync({ category, parent_id: parentId, value: v, sort: ++sort })
      setDraft('')
    } catch (e) {
      setError(message(e))
    }
  }

  async function rename() {
    if (!editing) return
    const value = editing.value.trim()
    const cur = list.find((o) => o.id === editing.id)
    setEditing(null)
    if (!cur || !value || value === cur.value) return
    setError('')
    try {
      await upsert.mutateAsync({ id: editing.id, category, value })
    } catch (e) {
      setError(message(e))
    }
  }

  const move = (i: number, by: number) => {
    const ids = list.map((o) => o.id)
    const j = i + by
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder.mutate(ids)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {list.length === 0 && <span className="text-xs text-slate-400">אין ערכים</span>}
        {list.map((o, i) => (
          <span key={o.id} className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1 pr-2 text-sm text-slate-700">
            {editing?.id === o.id ? (
              <input
                autoFocus
                dir="ltr"
                className="w-16 rounded border border-brand-300 bg-white px-1 text-center text-sm outline-none"
                value={editing.value}
                onChange={(e) => setEditing({ id: o.id, value: e.target.value })}
                onBlur={() => void rename()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void rename()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <button type="button" dir="ltr" className="min-w-6 px-0.5 hover:text-brand-600" title="לחץ לעריכה" onClick={() => setEditing({ id: o.id, value: o.value })}>
                {o.value}
              </button>
            )}
            <button type="button" className="text-slate-300 hover:text-slate-600 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="הזז ימינה" title="הזז קדימה">
              <ChevronRight size={13} />
            </button>
            <button type="button" className="text-slate-300 hover:text-slate-600 disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="הזז שמאלה" title="הזז אחורה">
              <ChevronLeft size={13} />
            </button>
            <button type="button" className="text-red-300 hover:text-red-500" onClick={() => del.mutate(o.id)} aria-label="מחק" title="מחק">
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        <input
          className="input !py-1 text-sm"
          dir="auto"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void add()
            }
          }}
        />
        <button className="btn-secondary shrink-0 !py-1" disabled={!draft.trim() || upsert.isPending} onClick={() => void add()} aria-label="הוסף">
          <Plus size={14} />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function FieldCard({
  f,
  row,
  index,
  total,
  siblings,
  options,
  onMove,
}: {
  f: ImplantFieldDef
  row: ImplantField | undefined
  index: number
  total: number
  siblings: ImplantFieldDef[]
  options: ImplantOption[]
  onMove: (by: number) => void
}) {
  const save = useSaveImplantField()
  const del = useDeleteImplantField()
  const [label, setLabel] = useState(f.label)
  const parent = siblings.find((s) => s.category === f.depends_on)
  const parentValues = parent ? generalOptions(parent.category, options) : []

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          className="input !w-40 !py-1 text-sm font-semibold"
          dir="auto"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => row && label.trim() && label !== f.label && save.mutate({ id: row.id, procedure_type: row.procedure_type, label, depends_on: row.depends_on })}
          aria-label="שם השדה"
        />
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <Link2 size={13} /> תלוי ב:
          <select
            className="input !w-auto !py-0.5 text-xs"
            value={f.depends_on ?? ''}
            disabled={!row}
            onChange={(e) => row && save.mutate({ id: row.id, procedure_type: row.procedure_type, label: f.label, depends_on: e.target.value || null })}
          >
            <option value="">— (רשימה אחת)</option>
            {siblings
              .filter((s) => s.category !== f.category)
              .map((s) => (
                <option key={s.category} value={s.category}>
                  {s.label}
                </option>
              ))}
          </select>
        </label>
        <span className="mr-auto flex items-center gap-0.5">
          <button className="btn-ghost !px-1.5 disabled:opacity-30" disabled={index === 0 || !row} onClick={() => onMove(-1)} aria-label="הזז למעלה">
            <ArrowUp size={14} />
          </button>
          <button className="btn-ghost !px-1.5 disabled:opacity-30" disabled={index === total - 1 || !row} onClick={() => onMove(1)} aria-label="הזז למטה">
            <ArrowDown size={14} />
          </button>
          {row && (
            <button
              className="btn-ghost !px-1.5 text-red-400"
              aria-label="מחק שדה"
              onClick={() => {
                if (window.confirm(`למחוק את השדה "${f.label}" ואת כל המידות שלו? מידות שכבר נרשמו בסריקות לא נמחקות מהסריקות.`)) del.mutate({ id: row.id, category: f.category })
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </span>
      </div>

      {parent && parentValues.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            לכל ערך של <b>{parent.label}</b> אפשר להגדיר רשימה משלו. אם לערך אין רשימה, תוצג הרשימה הכללית שלמטה.
          </p>
          {parentValues.map((pv) => {
            const n = options.filter((o) => o.parent_id === pv.id).length
            return (
              <div key={pv.id} className={classNames('rounded-lg border p-2', n ? 'border-brand-200 bg-brand-50/40' : 'border-slate-100 bg-slate-50/60')}>
                <p className="mb-1 text-xs font-medium text-slate-600">
                  כש־{parent.label} = <span dir="ltr">{pv.value}</span> {n ? '' : '(אין רשימה משלו)'}
                </p>
                <OptionList category={f.category} parentId={pv.id} options={options} placeholder="הוסף מידות לערך הזה (מופרדות בפסיק)" />
              </div>
            )
          })}
          <div className="rounded-lg border border-slate-100 p-2">
            <p className="mb-1 text-xs font-medium text-slate-600">רשימה כללית (לכל שאר הערכים)</p>
            <OptionList category={f.category} parentId={null} options={options} placeholder="הוסף מידה (אפשר כמה, מופרדות בפסיק)" />
          </div>
        </div>
      ) : (
        <OptionList category={f.category} parentId={null} options={options} placeholder="הוסף מידה (אפשר כמה, מופרדות בפסיק)" />
      )}
    </div>
  )
}

/** Settings → implant sizes: the fields of each procedure, their sizes, and the sizes that fit another field's value */
export function ImplantSettings() {
  const options = useImplantOptions()
  const fieldRows = useImplantFields()
  const saveField = useSaveImplantField()
  const reorderFields = useReorderImplantFields()
  const procedures = useMemo(() => [...new Set([...Object.keys(IMPLANT_FIELDS), ...(fieldRows.data ?? []).map((r) => r.procedure_type)])], [fieldRows.data])
  const [proc, setProc] = useState('knee')
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState('')

  const fields = useMemo(() => implantFieldsOf(proc, fieldRows.data), [proc, fieldRows.data])
  const rowOf = (key: string) => (fieldRows.data ?? []).find((r) => r.procedure_type === proc && r.key === key)

  if (options.isLoading || fieldRows.isLoading) return <Spinner />

  async function addField() {
    setError('')
    try {
      await saveField.mutateAsync({ procedure_type: proc, label: newLabel, sort: fields.length + 1 })
      setNewLabel('')
    } catch (e) {
      setError(message(e))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        המידות שמופיעות ברשימת הבחירה בסריקות MAKO. אפשר להוסיף, לשנות שם, לסדר מחדש ולמחוק כל ערך וכל שדה. שדה יכול להיות <b>תלוי</b> בשדה אחר:
        למשל Neck לפי גודל ה-Head — כש-Head הוא 36 תוצג הרשימה 0, +2.5, +5, וכש-32 הרשימה 0, 4, -4.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {procedures.map((p) => (
          <button
            key={p}
            className={classNames('chip transition', proc === p ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
            onClick={() => setProc(p)}
          >
            {SCAN_PROCEDURE_LABELS[p] ?? p}
          </button>
        ))}
      </div>

      {!fieldRows.data && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">רשימת השדות עדיין לא נטענה מהשרת — עריכה של שדות תתאפשר כשהחיבור יחזור.</p>}

      <div className="space-y-3">
        {fields.map((f, i) => (
          <FieldCard
            key={f.key}
            f={f}
            row={rowOf(f.key)}
            index={i}
            total={fields.length}
            siblings={fields}
            options={options.data ?? []}
            onMove={(by) => {
              const ids = (fieldRows.data ?? []).filter((r) => r.procedure_type === proc).sort((a, b) => a.sort - b.sort).map((r) => r.id)
              const j = i + by
              if (j < 0 || j >= ids.length) return
              ;[ids[i], ids[j]] = [ids[j], ids[i]]
              reorderFields.mutate(ids)
            }}
          />
        ))}
        {fields.length === 0 && <p className="text-sm text-slate-400">אין שדות לסוג הניתוח הזה.</p>}
      </div>

      <div className="flex max-w-md gap-2">
        <input className="input" dir="auto" placeholder="שדה חדש (למשל: Offset)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addField()} />
        <button className="btn-primary shrink-0" disabled={!newLabel.trim() || saveField.isPending || !fieldRows.data} onClick={() => void addField()}>
          <Plus size={16} /> הוסף שדה
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
