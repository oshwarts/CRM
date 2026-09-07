import { ChevronDown, ChevronUp } from 'lucide-react'
import type { MakoCell, MakoField, MakoTemplate } from '../lib/makoTemplates'
import { MakoBoneSVG } from './MakoBoneSVG'
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
  const set = (key: string, v: string | number) =>
    onChange?.({ ...values, [key]: v })

  return (
    <div
      dir="rtl"
      className="space-y-4 rounded-2xl bg-[#0e1116] p-3 text-slate-100 sm:p-4"
    >
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-100">
          MAKO
        </span>
        {template.label} · תכנון
      </div>

      {/* anatomical grid */}
      {template.grid.map((row, ri) => (
        <div key={ri} className="rounded-xl bg-black/30 p-2">
          <p className="mb-1 px-1 text-xs font-medium text-slate-400">
            {template.rowLabels[ri]}
          </p>
          <div
            className={classNames(
              'grid gap-2',
              row.length === 3
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
            {row.map((cell, ci) => (
              <Cell
                key={ci}
                cell={cell}
                values={values}
                onSet={set}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      ))}

      {/* extra setup fields */}
      {template.extras.map((section) => (
        <div key={section.title} className="rounded-xl bg-black/30 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-200">
            {section.title}
          </p>
          <div
            className={classNames(
              'grid gap-3',
              section.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
            )}
          >
            {section.fields.map((f) => (
              <PlainField
                key={f.key}
                field={f}
                value={values[f.key]}
                onSet={(v) => set(f.key, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------ anatomical cell */

function Cell({
  cell,
  values,
  onSet,
  readOnly,
}: {
  cell: MakoCell
  values: Values
  onSet: (key: string, v: string | number) => void
  readOnly: boolean
}) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-[#141a22] p-2">
      <span className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
        {cell.caption}
      </span>

      {cell.top && (
        <div className="mb-1 flex flex-wrap justify-center gap-2">
          {cell.top.map((f) => (
            <Stepper
              key={f.key}
              field={f}
              value={values[f.key]}
              onSet={(v) => onSet(f.key, v)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      <div className="h-24 w-full max-w-[150px]">
        <MakoBoneSVG name={cell.svg} />
      </div>

      {cell.bottom && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {cell.bottom.map((f) => (
            <Stepper
              key={f.key}
              field={f}
              value={values[f.key]}
              onSet={(v) => onSet(f.key, v)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Stepper({
  field: f,
  value,
  onSet,
  readOnly,
}: {
  field: MakoField
  value: unknown
  onSet: (v: number) => void
  readOnly: boolean
}) {
  if (f.type !== 'stepper') return null
  const raw = typeof value === 'number' ? value : Number(value)
  const n = Number.isFinite(raw) ? raw : f.default
  const bump = (dir: 1 | -1) =>
    onSet(Math.round((n + dir * f.step) * 100) / 100)

  return (
    <div className="text-center">
      <div className="mb-0.5 text-[10px] text-slate-400">{f.label}</div>
      <div className="flex items-stretch gap-0.5">
        <div className="flex min-w-[64px] items-center justify-center rounded-md border border-slate-700 bg-black/60 px-2 py-1 font-mono text-sm tabular-nums text-slate-100">
          {n.toFixed(1)}
          <span className="mr-0.5 text-[9px] text-slate-500">{f.unit}</span>
        </div>
        {!readOnly && (
          <div className="flex flex-col">
            <button
              type="button"
              className="flex-1 rounded-t border border-slate-700 bg-slate-700/50 px-1 hover:bg-slate-600"
              onClick={() => bump(1)}
            >
              <ChevronUp size={11} />
            </button>
            <button
              type="button"
              className="flex-1 rounded-b border border-slate-700 bg-slate-700/50 px-1 hover:bg-slate-600"
              onClick={() => bump(-1)}
            >
              <ChevronDown size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------ extras field */

function PlainField({
  field: f,
  value,
  onSet,
  readOnly,
}: {
  field: MakoField
  value: unknown
  onSet: (v: string | number) => void
  readOnly: boolean
}) {
  if (f.type === 'stepper') {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-400">{f.label}</span>
        <Stepper field={f} value={value} onSet={onSet} readOnly={readOnly} />
      </div>
    )
  }

  if (f.type === 'textarea') {
    return (
      <div className="sm:col-span-3">
        <div className="mb-1 text-xs text-slate-400">{f.label}</div>
        {readOnly ? (
          <p className="whitespace-pre-wrap rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm">
            {String(value ?? '') || '—'}
          </p>
        ) : (
          <textarea
            className="min-h-16 w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-brand-400"
            value={String(value ?? '')}
            onChange={(e) => onSet(e.target.value)}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 text-xs text-slate-400">{f.label}</div>
      {readOnly ? (
        <div className="rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm">
          {String(value ?? (f.type === 'select' ? f.default : '')) || '—'}
        </div>
      ) : f.type === 'select' ? (
        <select
          className="w-full rounded-lg border border-slate-700 bg-black/40 px-2 py-2 text-sm outline-none focus:border-brand-400"
          value={String(value ?? f.default)}
          onChange={(e) => onSet(e.target.value)}
        >
          {f.options.map((o) => (
            <option key={o} value={o} className="bg-slate-800">
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm outline-none focus:border-brand-400"
          value={String(value ?? '')}
          onChange={(e) => onSet(e.target.value)}
        />
      )}
    </div>
  )
}
