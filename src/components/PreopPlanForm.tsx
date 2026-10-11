import { allFields, optionLabel, type FormField, type PreopSchema } from '../lib/preopForm'

type Values = Record<string, unknown>

function PickField({
  field,
  value,
  onChange,
}: {
  field: FormField
  value: unknown
  onChange: (v: string) => void
}) {
  const cur = value === null || value === undefined ? '' : String(value)
  const known = field.options.some((o) => o.value === cur)
  return (
    <label className="block">
      <span className="label">{field.label}</span>
      <select className="input" value={cur} onChange={(e) => onChange(e.target.value)}>
        <option value="">— לא נקבע</option>
        {cur && !known && <option value={cur}>{cur}</option>}
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PreopPlanForm({
  schema,
  values,
  onChange,
}: {
  schema: PreopSchema
  values: Values
  onChange: (v: Values) => void
}) {
  return (
    <div className="space-y-4">
      {schema.groups.map((g, gi) => (
        <section key={g.title} className="rounded-xl border border-slate-200 p-3 sm:p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-xs text-white">
              {gi + 1}
            </span>
            {g.title}
          </h3>
          <div className="space-y-4">
            {g.blocks.map((b, bi) => (
              <div key={bi}>
                {b.sub && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {b.sub}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {b.fields.map((fl) => (
                    <PickField
                      key={fl.key}
                      field={fl}
                      value={values[fl.key]}
                      onChange={(v) => onChange({ ...values, [fl.key]: v })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <label className="block">
        <span className="label">הערות</span>
        <textarea
          className="input min-h-16"
          value={String(values.surgeon_notes ?? '')}
          onChange={(e) => onChange({ ...values, surgeon_notes: e.target.value })}
        />
      </label>
    </div>
  )
}

/** compact read-only summary used on the saved plan card */
export function PreopPlanSummary({ schema, values }: { schema: PreopSchema; values: Values }) {
  const fieldByKey = new Map(allFields(schema).map((f) => [f.key, f]))
  const notes = String(values.surgeon_notes ?? '')
  let any = false

  const groups = schema.groups.map((g) => {
    const blocks = g.blocks
      .map((b) => ({
        sub: b.sub,
        rows: b.fields
          .map((fl) => ({ fl, text: optionLabel(fieldByKey.get(fl.key)!, values[fl.key]) }))
          .filter((r) => r.text),
      }))
      .filter((b) => b.rows.length > 0)
    if (blocks.length) any = true
    return { title: g.title, blocks }
  })

  if (!any && !notes) return <p className="text-sm text-slate-400">לא הוזנו פרטים.</p>

  return (
    <div className="space-y-3">
      {groups
        .filter((g) => g.blocks.length > 0)
        .map((g) => (
          <div key={g.title}>
            <p className="mb-1 text-xs font-semibold text-slate-500">{g.title}</p>
            <div className="space-y-1.5 rounded-lg bg-slate-50 p-3">
              {g.blocks.map((b, i) => (
                <div key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                  {b.sub && <span className="w-14 text-xs font-semibold text-brand-600">{b.sub}</span>}
                  {b.rows.map(({ fl, text }) => (
                    <span key={fl.key} className="text-slate-700">
                      <span className="text-slate-400">{fl.label}: </span>
                      {text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      {notes && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">הערות</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{notes}</p>
        </div>
      )}
    </div>
  )
}
