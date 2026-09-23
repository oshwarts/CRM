import { useState } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import type {
  CellValue,
  GridCell,
  MakoComponentView,
  MakoField,
  MakoTemplate,
  PanelField,
  QuadField,
} from '../lib/makoTemplates'
import { componentFieldKey } from '../lib/makoTemplates'
import { MakoBoneSVG } from './MakoBoneSVG'
import { MakoKneePlanner } from './MakoKneePlanner'
import { classNames } from '../lib/utils'

type Values = Record<string, unknown>
type Setter = (key: string, v: string | number) => void

const num = (v: unknown, d = 0) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
const round = (n: number) => Math.round(n * 100) / 100

/** A MAKO-style value box with its own up / down steppers. */
function StepBox({
  label,
  axisRef,
  value,
  unit,
  step,
  onStep,
  readOnly,
  size = 'md',
}: {
  label?: string
  axisRef?: string
  value: number
  unit: string
  step: number
  onStep: (next: number) => void
  readOnly: boolean
  size?: 'sm' | 'md'
}) {
  const digits = unit === '°' ? 1 : 1
  return (
    <div className="text-center">
      {label && <div className="text-[10px] text-slate-400">{label}</div>}
      <div className="flex items-stretch justify-center gap-0.5">
        <div
          className={classNames(
            'rounded border border-slate-600 bg-black font-mono tabular-nums text-slate-100',
            size === 'md' ? 'min-w-[58px] px-2 py-1 text-base' : 'min-w-[46px] px-1.5 py-0.5 text-xs',
          )}
        >
          {Math.abs(value).toFixed(digits)}
          <span className="ml-0.5 text-[8px] text-slate-500">{unit}</span>
        </div>
        {!readOnly && (
          <div className="flex flex-col">
            <button
              type="button"
              className="flex-1 rounded-t border border-slate-700 bg-slate-700/60 px-1 hover:bg-slate-600"
              onClick={() => onStep(round(value + step))}
              aria-label="הגדל"
            >
              <ChevronUp size={10} />
            </button>
            <button
              type="button"
              className="flex-1 rounded-b border border-slate-700 bg-slate-700/60 px-1 hover:bg-slate-600"
              onClick={() => onStep(round(value - step))}
              aria-label="הקטן"
            >
              <ChevronDown size={10} />
            </button>
          </div>
        )}
      </div>
      {axisRef && (
        <div className="text-[9px] font-semibold text-pink-400">{axisRef}</div>
      )}
    </div>
  )
}

export function MakoPlanForm(props: {
  template: MakoTemplate
  values: Values
  onChange?: (next: Values) => void
  readOnly?: boolean
}) {
  const { template, values, onChange, readOnly = false } = props
  const set: Setter = (key, v) => onChange?.({ ...values, [key]: v })

  if (template.layout === 'knee') {
    return (
      <div className="space-y-2">
        <MakoKneePlanner values={values} onChange={onChange} readOnly={readOnly} />
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-[#12151a]">
          <ExtrasBlock template={template} values={values} set={set} readOnly={readOnly} />
        </div>
      </div>
    )
  }

  return (
    <div dir="ltr" className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0b0d10] text-slate-100">
      <div className="flex items-center gap-1 bg-gradient-to-b from-slate-700 to-slate-800 px-3 py-1.5 text-xs">
        <span className="rounded bg-lime-500 px-3 py-1 font-semibold text-slate-900">
          Case Planning
        </span>
        <span className="px-3 py-1 text-slate-400">Intra-Op Planning</span>
        <span className="px-3 py-1 text-slate-400">Case Completion</span>
        <span className="ml-auto text-slate-500">{template.label}</span>
      </div>

      {template.layout === 'grid' ? (
        <GridPlanner template={template} values={values} set={set} readOnly={readOnly} />
      ) : (
        <QuadPlanner template={template} values={values} set={set} readOnly={readOnly} />
      )}

      <ExtrasBlock template={template} values={values} set={set} readOnly={readOnly} />
    </div>
  )
}

/* ================================ GRID (TKA) ================================ */

function GridPlanner({
  template,
  values,
  set,
  readOnly,
}: {
  template: MakoTemplate
  values: Values
  set: Setter
  readOnly: boolean
}) {
  return (
    <div className="grid gap-2 p-2 lg:grid-cols-[1fr_180px]">
      <div className="space-y-2">
        {(template.rows ?? []).map((row) => (
          <div key={row.label} className="rounded-lg bg-black/40 p-1.5">
            <p className="mb-1 px-1 text-[11px] font-semibold text-slate-400">
              {row.label}
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {row.cells.map((cell, i) => (
                <GridCellView
                  key={i}
                  cell={cell}
                  values={values}
                  readOnly={readOnly}
                  set={set}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* dark right rail */}
      <div className="rounded-lg bg-[#1a1d22] p-2 text-xs">
        <p className="mb-2 rounded bg-black/40 px-2 py-1 font-semibold text-slate-200">
          {template.greenHeader}
        </p>
        {(template.rail ?? []).map((s) => {
          const n = num(values[s.key], s.default)
          return (
            <div key={s.key} className="mb-2">
              <div className="mb-0.5 flex items-center justify-between text-slate-300">
                <span>{s.label}</span>
                {s.prefix && <span className="text-slate-500">{s.prefix} ▾</span>}
              </div>
              <div className="flex items-stretch gap-1">
                {!readOnly && (
                  <button className="rounded bg-black/40 px-2 hover:bg-slate-700" onClick={() => set(s.key, n - 1)}>
                    <Minus size={12} />
                  </button>
                )}
                <div className="flex-1 rounded border border-slate-600 bg-black/40 py-1 text-center font-mono">
                  {n}
                </div>
                {!readOnly && (
                  <button className="rounded bg-black/40 px-2 hover:bg-slate-700" onClick={() => set(s.key, n + 1)}>
                    <Plus size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <p className="mt-3 border-t border-slate-700 pt-2 text-slate-300">
          Operative Side:{' '}
          <span className="font-semibold text-slate-100">
            {String(values['operative_side'] ?? 'left')}
          </span>
        </p>
        <div className="mt-3 flex gap-1 border-t border-slate-700 pt-2 text-slate-400">
          <span className="flex-1 rounded bg-black/40 py-1 text-center">◀</span>
          <span className="flex-[3] rounded bg-black/40 py-1 text-center">Implant Planning</span>
          <span className="flex-1 rounded bg-black/40 py-1 text-center">▶</span>
        </div>
      </div>
    </div>
  )
}

function GridCellView({
  cell,
  values,
  readOnly,
  set,
}: {
  cell: GridCell
  values: Values
  readOnly: boolean
  set: Setter
}) {
  const renderValues = (list: CellValue[], small = false) => (
    <div className="flex flex-wrap justify-center gap-2">
      {list.map((v) => {
        const val = num(values[v.key], v.default)
        return v.kind === 'angle' ? (
          <StepBox
            key={v.key}
            label={val >= 0 ? v.posLabel : v.negLabel}
            axisRef={v.ref}
            value={val}
            unit="°"
            step={v.step}
            readOnly={readOnly}
            size={small ? 'sm' : 'md'}
            onStep={(n) => set(v.key, n)}
          />
        ) : (
          <StepBox
            key={v.key}
            label={v.label}
            value={val}
            unit="mm"
            step={v.step}
            readOnly={readOnly}
            size="sm"
            onStep={(n) => set(v.key, Math.max(0, n))}
          />
        )
      })}
    </div>
  )

  return (
    <div className="relative rounded-lg border border-slate-800 bg-black p-1">
      <span className="absolute left-1.5 top-1 z-10 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {cell.plane}
      </span>

      {cell.top && <div className="mb-1 mt-4">{renderValues(cell.top)}</div>}

      <div className="mx-auto h-24 w-full max-w-[170px]">
        <MakoBoneSVG bone={cell.bone} view={cell.plane} refLines />
      </div>

      {cell.bottom && <div className="mt-1">{renderValues(cell.bottom, true)}</div>}
    </div>
  )
}

/* ================================ QUAD (PKA / THA) ================================ */

function QuadPlanner({
  template,
  values,
  set,
  readOnly,
}: {
  template: MakoTemplate
  values: Values
  set: Setter
  readOnly: boolean
}) {
  const [activeId, setActiveId] = useState(template.components![0].id)
  const active =
    template.components!.find((c) => c.id === activeId) ?? template.components![0]
  const ck = (k: string) => componentFieldKey(active.id, k)

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-[1fr_190px] gap-2 p-2">
      <div className="grid grid-cols-2 gap-1.5">
        <QuadCell title="TRANSVERSE" sideLabel="Med" bone={active.bone} view="transverse" q={active.transverse}
          value={num(values[ck(active.transverse.key)], active.transverse.default)}
          readOnly={readOnly} onStep={(n) => set(ck(active.transverse.key), n)} />
        <div className="relative rounded-lg border border-slate-800 bg-black p-1">
          <span className="absolute left-2 top-1 text-[10px] text-slate-500">3D</span>
          <div className="mx-auto h-full max-h-40 w-full">
            <MakoBoneSVG bone={active.bone} view="model" />
          </div>
        </div>
        <QuadCell title="CORONAL" sideLabel="Med" bone={active.bone} view="coronal" q={active.coronal}
          value={num(values[ck(active.coronal.key)], active.coronal.default)}
          readOnly={readOnly} onStep={(n) => set(ck(active.coronal.key), n)} />
        <QuadCell title="SAGITTAL" sideLabel="P" bone={active.bone} view="sagittal" q={active.sagittal}
          value={num(values[ck(active.sagittal.key)], active.sagittal.default)}
          readOnly={readOnly} onStep={(n) => set(ck(active.sagittal.key), n)} />
      </div>

      <div className="rounded-lg bg-gradient-to-b from-[#2a3a56] to-[#1c2740] p-2 text-xs">
        <p className="mb-2 rounded bg-black/30 px-2 py-1 font-semibold text-lime-400">
          {template.greenHeader}
        </p>
        <label className="mb-1 block text-slate-300">Implant View</label>
        <select
          className="mb-2 w-full rounded border border-slate-600 bg-slate-900/70 px-2 py-1 text-slate-100"
          value={active.id}
          onChange={(e) => setActiveId(e.target.value)}
        >
          {template.components!.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        {active.panel.map((f) => (
          <PanelControl key={f.key} field={f} value={values[ck(f.key)]} readOnly={readOnly} onSet={(v) => set(ck(f.key), v)} />
        ))}
        <p className="mt-3 border-t border-slate-600 pt-2 text-slate-300">
          Operative Side:{' '}
          <span className="font-semibold text-slate-100">
            {String(values['operative_side'] ?? 'left')}
          </span>
        </p>
        <div className="mt-3 flex gap-1 border-t border-slate-600 pt-2 text-slate-400">
          <span className="flex-1 rounded bg-slate-900/50 py-1 text-center">◀ Back</span>
          <span className="flex-1 rounded bg-slate-900/50 py-1 text-center">Next ▶</span>
        </div>
      </div>
      </div>
    </div>
  )
}

function QuadCell({
  title, sideLabel, bone, view, q, value, readOnly, onStep,
}: {
  title: string
  sideLabel: string
  bone: MakoComponentView['bone']
  view: 'transverse' | 'coronal' | 'sagittal'
  q: QuadField
  value: number
  readOnly: boolean
  onStep: (next: number) => void
}) {
  const label = value >= 0 ? q.posLabel : q.negLabel
  return (
    <div className="relative rounded-lg border border-slate-800 bg-black p-1">
      <span className="absolute left-2 top-1 z-10 text-[10px] font-semibold tracking-wide text-slate-300">
        {title}
      </span>
      <div className="mx-auto mt-4 h-28 w-full max-w-[190px]">
        <MakoBoneSVG bone={bone} view={view} />
      </div>
      <span className="absolute bottom-9 left-2 text-[10px] text-slate-500">{sideLabel}</span>
      <div className="mt-1 flex justify-center px-1">
        <StepBox
          label={label}
          value={value}
          unit={q.unit}
          step={q.step}
          readOnly={readOnly}
          onStep={onStep}
        />
      </div>
    </div>
  )
}

function PanelControl({
  field: f, value, onSet, readOnly,
}: {
  field: PanelField
  value: unknown
  onSet: (v: string | number) => void
  readOnly: boolean
}) {
  if (f.type === 'proud') {
    const n = num(value, f.default)
    return (
      <div className="mb-2">
        <label className="mb-1 block text-slate-300">{f.label}</label>
        <div className="flex items-stretch gap-1">
          {!readOnly && (
            <button type="button" className="rounded bg-slate-900/70 px-2 hover:bg-slate-700" onClick={() => onSet(round(n - f.step))}>
              <Minus size={12} />
            </button>
          )}
          <div className="flex-1 rounded border border-slate-600 bg-slate-900/70 py-1 text-center font-mono">
            Proud {n.toFixed(1)} mm
          </div>
          {!readOnly && (
            <button type="button" className="rounded bg-slate-900/70 px-2 hover:bg-slate-700" onClick={() => onSet(round(n + f.step))}>
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>
    )
  }
  if (f.type === 'text') {
    return (
      <div className="mb-2">
        <label className="mb-1 block text-slate-300">{f.label}</label>
        <input
          className="w-full rounded border border-slate-600 bg-slate-900/70 px-2 py-1 text-slate-100"
          value={String(value ?? f.default ?? '')}
          onChange={(e) => onSet(e.target.value)}
          readOnly={readOnly}
        />
      </div>
    )
  }
  return (
    <div className="mb-2">
      <label className="mb-1 block text-slate-300">{f.label}</label>
      {readOnly ? (
        <div className="w-full rounded border border-slate-600 bg-slate-900/70 px-2 py-1">
          {String(value ?? f.default)}
        </div>
      ) : (
        <select
          className="w-full rounded border border-slate-600 bg-slate-900/70 px-2 py-1 text-slate-100"
          value={String(value ?? f.default)}
          onChange={(e) => onSet(e.target.value)}
        >
          {f.options.map((o) => (
            <option key={o} value={o} className="bg-slate-800">{o}</option>
          ))}
        </select>
      )}
    </div>
  )
}

/* ================================ extras ================================ */

function ExtrasBlock({
  template, values, set, readOnly,
}: {
  template: MakoTemplate
  values: Values
  set: Setter
  readOnly: boolean
}) {
  return (
    <div className="space-y-3 border-t border-slate-800 bg-[#12151a] p-3">
      {template.extras.map((section) => (
        <div key={section.title}>
          <p className="mb-2 text-sm font-semibold text-slate-200">{section.title}</p>
          <div
            dir="rtl"
            className={classNames(
              'grid gap-3',
              section.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
            )}
          >
            {section.fields.map((f) => (
              <ExtraField key={f.key} field={f} value={values[f.key]} onSet={(v) => set(f.key, v)} readOnly={readOnly} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ExtraField({
  field: f, value, onSet, readOnly,
}: {
  field: MakoField
  value: unknown
  onSet: (v: string | number) => void
  readOnly: boolean
}) {
  if (f.type === 'stepper') {
    const n = num(value, f.default)
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-400">{f.label}</span>
        <div className="flex items-stretch gap-1">
          {!readOnly && (
            <button className="rounded bg-slate-800 px-1.5" onClick={() => onSet(round(n - f.step))}>
              <Minus size={11} />
            </button>
          )}
          <span className="min-w-[54px] rounded border border-slate-700 bg-black/50 px-2 py-1 text-center font-mono text-sm">
            {n.toFixed(1)}
            <span className="text-[9px] text-slate-500">{f.unit}</span>
          </span>
          {!readOnly && (
            <button className="rounded bg-slate-800 px-1.5" onClick={() => onSet(round(n + f.step))}>
              <Plus size={11} />
            </button>
          )}
        </div>
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
            <option key={o} value={o} className="bg-slate-800">{o}</option>
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
