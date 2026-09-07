import { ChevronDown, ChevronUp } from 'lucide-react'
import type { MakoField, MakoTemplate } from '../lib/makoTemplates'
import { classNames } from '../lib/utils'

type Values = Record<string, unknown>

export function MakoPlanForm({
  template,
  values,
  onChange,
  readOnly = false,
}: {
  template: MakoTemplate
  values: Values
  onChange?: (next: Values) => void
  readOnly?: boolean
}) {
  function set(key: string, v: string | number) {
    onChange?.({ ...values, [key]: v })
  }

  return (
    <div dir="rtl" className="space-y-4 rounded-2xl bg-slate-900 p-4 text-slate-100">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-200">MAKO</span>
        {template.label}
      </div>

      {template.sections.map((section) => (
        <div key={section.title} className="rounded-xl bg-slate-800/70 p-3">
          <p className="mb-3 text-sm font-semibold text-slate-200">
            {section.title}
          </p>
          <div
            className={classNames(
              'grid gap-3',
              section.columns === 3
                ? 'sm:grid-cols-3'
                : section.columns === 2
                  ? 'sm:grid-cols-2'
                  : 'sm:grid-cols-2',
            )}
          >
            {section.fields.map((f) => (
              <FieldControl
                key={f.key}
                field={f}
                value={values[f.key]}
                readOnly={readOnly}
                onChange={(v) => set(f.key, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldControl({
  field: f,
  value,
  onChange,
  readOnly,
}: {
  field: MakoField
  value: unknown
  onChange: (v: string | number) => void
  readOnly: boolean
}) {
  const labelBlock = (
    <div className="mb-1 text-center text-xs text-slate-400">
      {f.label}
      {'sub' in f && f.sub ? (
        <span className="block text-[10px] text-slate-500">{f.sub}</span>
      ) : null}
    </div>
  )

  if (f.type === 'stepper') {
    const num = typeof value === 'number' ? value : Number(value ?? f.default)
    const shown = Number.isFinite(num) ? num : f.default
    return (
      <div>
        {labelBlock}
        <div className="flex items-stretch justify-center gap-1">
          <div className="flex min-w-[92px] items-center justify-center rounded-lg border border-slate-700 bg-black/50 px-3 py-2 font-mono text-lg tabular-nums">
            {shown.toFixed(f.unit === '°' ? 1 : 1)}
            <span className="mr-1 text-xs text-slate-500">{f.unit}</span>
          </div>
          {!readOnly && (
            <div className="flex flex-col">
              <button
                type="button"
                className="flex-1 rounded-t-md border border-slate-700 bg-slate-700/60 px-1.5 hover:bg-slate-600"
                onClick={() => onChange(Math.round((shown + f.step) * 100) / 100)}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                className="flex-1 rounded-b-md border border-slate-700 bg-slate-700/60 px-1.5 hover:bg-slate-600"
                onClick={() => onChange(Math.round((shown - f.step) * 100) / 100)}
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (f.type === 'select') {
    return (
      <div>
        {labelBlock}
        {readOnly ? (
          <div className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-center text-sm">
            {String(value ?? f.default)}
          </div>
        ) : (
          <select
            className="w-full rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm outline-none focus:border-brand-400"
            value={String(value ?? f.default)}
            onChange={(e) => onChange(e.target.value)}
          >
            {f.options.map((o) => (
              <option key={o} value={o} className="bg-slate-800">
                {o}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  if (f.type === 'textarea') {
    return (
      <div className="sm:col-span-3">
        <div className="mb-1 text-xs text-slate-400">{f.label}</div>
        {readOnly ? (
          <p className="whitespace-pre-wrap rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm text-slate-200">
            {String(value ?? '') || '—'}
          </p>
        ) : (
          <textarea
            className="min-h-20 w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-brand-400"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    )
  }

  // text
  return (
    <div>
      {labelBlock}
      {readOnly ? (
        <div className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-center text-sm">
          {String(value ?? '') || '—'}
        </div>
      ) : (
        <input
          className="w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-center text-sm outline-none focus:border-brand-400"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
