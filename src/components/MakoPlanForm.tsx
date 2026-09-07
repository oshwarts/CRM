import { useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Minus,
  Plus,
} from 'lucide-react'
import type {
  MakoComponentView,
  MakoField,
  MakoTemplate,
  PanelField,
  QuadField,
} from '../lib/makoTemplates'
import { componentFieldKey } from '../lib/makoTemplates'
import { MakoBoneSVG } from './MakoBoneSVG'
import { classNames } from '../lib/utils'

type Values = Record<string, unknown>

const num = (v: unknown, d = 0) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
const round = (n: number) => Math.round(n * 100) / 100

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
  const [activeId, setActiveId] = useState(template.components[0].id)
  const active =
    template.components.find((c) => c.id === activeId) ?? template.components[0]

  const set = (key: string, v: string | number) =>
    onChange?.({ ...values, [key]: v })

  const ck = (k: string) => componentFieldKey(active.id, k)

  function nudge(q: QuadField, dAngle: number, dPos: number) {
    if (dAngle) set(ck(q.key), round(num(values[ck(q.key)], q.default) + dAngle * q.step))
    if (dPos) {
      const pk = ck(q.key + '__pos')
      set(pk, round(num(values[pk]) + dPos))
    }
  }

  return (
    <div dir="ltr" className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0b0d10] text-slate-100">
      {/* workflow tabs */}
      <div className="flex items-center gap-1 bg-gradient-to-b from-slate-700 to-slate-800 px-3 py-1.5 text-xs">
        <span className="rounded bg-lime-500 px-3 py-1 font-semibold text-slate-900">
          Case Planning
        </span>
        <span className="px-3 py-1 text-slate-400">Case Completion</span>
        <span className="ml-auto text-slate-500">{template.label}</span>
      </div>

      <div className="grid gap-2 p-2 lg:grid-cols-[1fr_190px]">
        {/* 2x2 quadrant view */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <Quadrant
            title="TRANSVERSE"
            sideLabel="Med"
            bone={active.bone}
            view="transverse"
            q={active.transverse}
            value={num(values[ck(active.transverse.key)], active.transverse.default)}
            pos={num(values[ck(active.transverse.key + '__pos')])}
            readOnly={readOnly}
            onNudge={(a, p) => nudge(active.transverse, a, p)}
          />
          <div className="relative rounded-lg border border-slate-800 bg-black p-1">
            <span className="absolute left-2 top-1 text-[10px] text-slate-500">3D</span>
            <div className="mx-auto h-full max-h-40 w-full">
              <MakoBoneSVG bone={active.bone} view="model" />
            </div>
          </div>
          <Quadrant
            title="CORONAL"
            sideLabel="Med"
            bone={active.bone}
            view="coronal"
            q={active.coronal}
            value={num(values[ck(active.coronal.key)], active.coronal.default)}
            pos={num(values[ck(active.coronal.key + '__pos')])}
            readOnly={readOnly}
            onNudge={(a, p) => nudge(active.coronal, a, p)}
          />
          <Quadrant
            title="SAGITTAL"
            sideLabel="P"
            bone={active.bone}
            view="sagittal"
            q={active.sagittal}
            value={num(values[ck(active.sagittal.key)], active.sagittal.default)}
            pos={num(values[ck(active.sagittal.key + '__pos')])}
            readOnly={readOnly}
            onNudge={(a, p) => nudge(active.sagittal, a, p)}
          />
        </div>

        {/* right rail */}
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
            {template.components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {active.panel.map((f) => (
            <PanelControl
              key={f.key}
              field={f}
              value={values[ck(f.key)]}
              readOnly={readOnly}
              onSet={(v) => set(ck(f.key), v)}
            />
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

      {/* extras */}
      <div className="space-y-3 border-t border-slate-800 bg-[#12151a] p-3">
        {template.extras.map((section) => (
          <div key={section.title}>
            <p className="mb-2 text-sm font-semibold text-slate-200">
              {section.title}
            </p>
            <div
              dir="rtl"
              className={classNames(
                'grid gap-3',
                section.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
              )}
            >
              {section.fields.map((f) => (
                <ExtraField
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
    </div>
  )
}

/* ------------------------------------------------------- quadrant */

function Quadrant({
  title,
  sideLabel,
  bone,
  view,
  q,
  value,
  pos,
  readOnly,
  onNudge,
}: {
  title: string
  sideLabel: string
  bone: MakoComponentView['bone']
  view: 'transverse' | 'coronal' | 'sagittal'
  q: QuadField
  value: number
  pos: number
  readOnly: boolean
  onNudge: (dAngle: number, dPos: number) => void
}) {
  const label = value === 0 ? q.posLabel : value > 0 ? q.posLabel : q.negLabel
  const pad: [React.ReactNode, number, number][] = [
    [<ArrowUpLeft size={12} />, 1, -1],
    [<ArrowUp size={12} />, 1, 0],
    [<ArrowUpRight size={12} />, 1, 1],
    [<ArrowLeft size={12} />, 0, -1],
    [<ArrowDown size={12} />, -1, 0],
    [<ArrowRight size={12} />, 0, 1],
  ]

  return (
    <div className="relative rounded-lg border border-slate-800 bg-black p-1">
      <span className="absolute left-2 top-1 z-10 text-[10px] font-semibold tracking-wide text-slate-300">
        {title}
      </span>

      {!readOnly && (
        <div className="absolute right-1 top-1 z-10 grid grid-cols-3 gap-0.5">
          {pad.map(([icon, a, p], i) => (
            <button
              key={i}
              type="button"
              className="rounded bg-slate-700/70 p-0.5 text-slate-300 hover:bg-slate-600"
              onClick={() => onNudge(a, p)}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto mt-4 h-28 w-full max-w-[190px]">
        <MakoBoneSVG bone={bone} view={view} />
      </div>

      <span className="absolute bottom-9 left-2 text-[10px] text-slate-500">
        {sideLabel}
      </span>

      <div className="mt-1 flex items-end gap-2 px-1">
        <div>
          <div className="text-[10px] text-slate-400">{label}</div>
          <div className="min-w-[70px] rounded border border-slate-600 bg-black px-2 py-1 font-mono text-lg tabular-nums text-slate-100">
            {Math.abs(value).toFixed(1)}
            <span className="ml-0.5 text-[9px] text-slate-500">{q.unit}</span>
          </div>
        </div>
        {pos !== 0 && (
          <div className="pb-1 text-[10px] text-slate-500">
            pos {pos > 0 ? '+' : ''}
            {pos.toFixed(1)}mm
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- right-rail control */

function PanelControl({
  field: f,
  value,
  onSet,
  readOnly,
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
            <button
              type="button"
              className="rounded bg-slate-900/70 px-2 hover:bg-slate-700"
              onClick={() => onSet(round(n - f.step))}
            >
              <Minus size={12} />
            </button>
          )}
          <div className="flex-1 rounded border border-slate-600 bg-slate-900/70 py-1 text-center font-mono">
            Proud {n.toFixed(1)} mm
          </div>
          {!readOnly && (
            <button
              type="button"
              className="rounded bg-slate-900/70 px-2 hover:bg-slate-700"
              onClick={() => onSet(round(n + f.step))}
            >
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
            <option key={o} value={o} className="bg-slate-800">
              {o}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

/* ------------------------------------------------------- extras */

function ExtraField({
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
