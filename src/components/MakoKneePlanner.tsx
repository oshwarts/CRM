import type { ReactNode } from 'react'
import { AlertTriangle, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'
import {
  KNEE_DEFAULTS,
  computeKnee,
  mlOrder,
  type KneeDerived,
  type KneeInputs,
} from '../lib/kneeModel'
import { MakoBoneSVG } from './MakoBoneSVG'

type Values = Record<string, unknown>

const num = (v: unknown, d = 0) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
const r1 = (n: number) => Math.round(n * 10) / 10
const signed = (n: number, unit: string) =>
  `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(1)}${unit}`

function readInputs(values: Values): KneeInputs {
  const g = (k: keyof KneeInputs) =>
    num(values[k], KNEE_DEFAULTS[k] as number)
  return {
    side: values.side === 'right' ? 'right' : 'left',
    fem_coronal: g('fem_coronal'),
    fem_rotation: g('fem_rotation'),
    fem_flexion: g('fem_flexion'),
    fem_distal: g('fem_distal'),
    fem_posterior: g('fem_posterior'),
    fem_size: g('fem_size'),
    tib_coronal: g('tib_coronal'),
    tib_rotation: g('tib_rotation'),
    tib_slope: g('tib_slope'),
    tib_resection: g('tib_resection'),
    tib_size: g('tib_size'),
    poly: g('poly'),
    aa_ma_offset: g('aa_ma_offset'),
    pca_tea_offset: g('pca_tea_offset'),
  }
}

/* -------------------------------- pieces -------------------------------- */

function AngleBox({
  label,
  axisRef,
  value,
}: {
  label: string
  axisRef?: string
  value: number
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="min-w-[56px] rounded border border-slate-600 bg-black px-2 py-1 font-mono text-base tabular-nums text-slate-100">
        {Math.abs(value).toFixed(1)}
        <span className="ml-0.5 text-[8px] text-slate-500">°</span>
      </div>
      {axisRef && (
        <div className="text-[9px] font-semibold text-pink-400">{axisRef}</div>
      )}
    </div>
  )
}

function MmBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="rounded border border-slate-600 bg-black px-2 py-0.5 font-mono text-xs text-slate-100">
        {Math.max(0, value).toFixed(1)}
        <span className="text-[8px] text-slate-500">mm</span>
      </div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  )
}

function Cluster({
  onRotate,
  onResect,
}: {
  onRotate: (d: number) => void
  onResect?: (d: number) => void
}) {
  return (
    <div className="absolute right-1 top-1 z-10 flex flex-col gap-0.5">
      <div className="flex gap-0.5">
        <button className="rounded bg-slate-700/70 p-0.5 hover:bg-slate-600" title="סיבוב −" onClick={() => onRotate(-0.5)}>
          <RotateCcw size={12} />
        </button>
        <button className="rounded bg-slate-700/70 p-0.5 hover:bg-slate-600" title="סיבוב +" onClick={() => onRotate(0.5)}>
          <RotateCw size={12} />
        </button>
      </div>
      {onResect && (
        <div className="flex gap-0.5">
          <button className="rounded bg-slate-700/70 p-0.5 hover:bg-slate-600" title="חיתוך רדוד יותר" onClick={() => onResect(-0.5)}>
            <Minus size={12} />
          </button>
          <button className="rounded bg-slate-700/70 p-0.5 hover:bg-slate-600" title="חיתוך עמוק יותר" onClick={() => onResect(0.5)}>
            <Plus size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

function Cell({
  plane,
  bone,
  tilt,
  shift = 0,
  mirror,
  refLines = true,
  cluster,
  children,
}: {
  plane: 'Coronal' | 'Axial' | 'Sagittal'
  bone: 'femur' | 'tibia'
  tilt: number
  shift?: number
  mirror: boolean
  refLines?: boolean
  cluster: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative rounded-lg border border-slate-800 bg-black p-1">
      <span className="absolute left-1.5 top-1 z-10 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {plane}
      </span>
      {cluster}
      <div className="mx-auto mt-5 h-[104px] w-full max-w-[178px]">
        <MakoBoneSVG
          bone={bone}
          view={plane.toLowerCase() as 'coronal' | 'axial' | 'sagittal'}
          refLines={refLines}
          implantTilt={tilt}
          implantShift={shift}
          mirror={mirror}
        />
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/40 p-2 text-center">
      <p className="text-lg font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}

function RailStep({
  label,
  prefix,
  value,
  onStep,
  readOnly,
}: {
  label: string
  prefix?: string
  value: number
  onStep: (d: number) => void
  readOnly: boolean
}) {
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex items-center justify-between text-slate-300">
        <span>{label}</span>
        {prefix && <span className="text-slate-500">{prefix}</span>}
      </div>
      <div className="flex items-stretch gap-1">
        {!readOnly && (
          <button className="rounded bg-black/40 px-2 hover:bg-slate-700" onClick={() => onStep(-1)}>
            <Minus size={12} />
          </button>
        )}
        <div className="flex-1 rounded border border-slate-600 bg-black/40 py-1 text-center font-mono">
          {value}
        </div>
        {!readOnly && (
          <button className="rounded bg-black/40 px-2 hover:bg-slate-700" onClick={() => onStep(1)}>
            <Plus size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

/* -------------------------------- planner -------------------------------- */

export function MakoKneePlanner({
  values,
  onChange,
  readOnly = false,
}: {
  values: Values
  onChange?: (next: Values) => void
  readOnly?: boolean
}) {
  const inp = readInputs(values)
  const d: KneeDerived = computeKnee(inp)
  const [leftLabel, rightLabel] = mlOrder(inp.side)
  const isLeft = inp.side === 'left'

  const bump = (key: keyof KneeInputs, delta: number) =>
    !readOnly &&
    onChange?.({
      ...values,
      [key]: r1(num(values[key], KNEE_DEFAULTS[key] as number) + delta),
    })

  const distalL = isLeft ? d.distalLat : d.distalMed
  const distalR = isLeft ? d.distalMed : d.distalLat
  const postL = isLeft ? d.postLat : d.postMed
  const postR = isLeft ? d.postMed : d.postLat
  const tibL = isLeft ? d.tibLat : d.tibMed
  const tibR = isLeft ? d.tibMed : d.tibLat

  return (
    <div dir="ltr" className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0b0d10] text-slate-100">
      <div className="flex items-center gap-1 bg-gradient-to-b from-slate-700 to-slate-800 px-3 py-1.5 text-xs">
        <span className="rounded bg-lime-500 px-3 py-1 font-semibold text-slate-900">Case Planning</span>
        <span className="px-3 py-1 text-slate-400">Intra-Op Planning</span>
        <span className="px-3 py-1 text-slate-400">Case Completion</span>
        <span className="ml-auto text-slate-500">MAKO – החלפת ברך מלאה</span>
      </div>

      <div className="grid gap-2 p-2 lg:grid-cols-[1fr_170px]">
        <div className="space-y-2">
          {/* FEMUR */}
          <div className="rounded-lg bg-black/40 p-1.5">
            <p className="mb-1 px-1 text-[11px] font-semibold text-slate-400">Femur</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <Cell
                plane="Coronal"
                bone="femur"
                mirror={!isLeft}
                tilt={-inp.fem_coronal}
                shift={(inp.fem_distal - KNEE_DEFAULTS.fem_distal) * 2}
                cluster={<Cluster onRotate={(x) => bump('fem_coronal', x)} onResect={(x) => bump('fem_distal', x)} />}
              >
                <div className="flex justify-center gap-2">
                  <AngleBox label={d.femValgusAA >= 0 ? 'Valgus' : 'Varus'} axisRef="AA" value={d.femValgusAA} />
                  <AngleBox label={d.femValgusMA >= 0 ? 'Valgus' : 'Varus'} axisRef="MA" value={d.femValgusMA} />
                </div>
                <div className="mt-1 flex justify-center gap-3">
                  <MmBox label={leftLabel} value={distalL} />
                  <MmBox label={rightLabel} value={distalR} />
                </div>
              </Cell>

              <Cell
                plane="Axial"
                bone="femur"
                mirror={!isLeft}
                tilt={inp.fem_rotation}
                cluster={<Cluster onRotate={(x) => bump('fem_rotation', x)} onResect={(x) => bump('fem_posterior', x)} />}
              >
                <div className="flex justify-center gap-2">
                  <AngleBox label={d.femRotPCA >= 0 ? 'External' : 'Internal'} axisRef="PCA" value={d.femRotPCA} />
                  <AngleBox label={d.femRotTEA >= 0 ? 'External' : 'Internal'} axisRef="TEA" value={d.femRotTEA} />
                </div>
                <div className="mt-1 flex justify-center gap-3">
                  <MmBox label={leftLabel} value={postL} />
                  <MmBox label={rightLabel} value={postR} />
                </div>
              </Cell>

              <Cell
                plane="Sagittal"
                bone="femur"
                mirror={false}
                tilt={-inp.fem_flexion}
                refLines={false}
                cluster={<Cluster onRotate={(x) => bump('fem_flexion', x)} />}
              >
                <div className="flex justify-center">
                  <AngleBox label={inp.fem_flexion >= 0 ? 'Flexion' : 'Extension'} value={inp.fem_flexion} />
                </div>
              </Cell>
            </div>
          </div>

          {/* TIBIA */}
          <div className="rounded-lg bg-black/40 p-1.5">
            <p className="mb-1 px-1 text-[11px] font-semibold text-slate-400">Tibia</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <Cell
                plane="Coronal"
                bone="tibia"
                mirror={!isLeft}
                tilt={inp.tib_coronal}
                shift={(inp.tib_resection - KNEE_DEFAULTS.tib_resection) * 2}
                refLines={false}
                cluster={<Cluster onRotate={(x) => bump('tib_coronal', x)} onResect={(x) => bump('tib_resection', x)} />}
              >
                <div className="flex justify-center">
                  <AngleBox label={inp.tib_coronal >= 0 ? 'Varus' : 'Valgus'} value={inp.tib_coronal} />
                </div>
                <div className="mt-1 flex justify-center gap-3">
                  <MmBox label={leftLabel} value={tibL} />
                  <MmBox label={rightLabel} value={tibR} />
                </div>
              </Cell>

              <Cell
                plane="Axial"
                bone="tibia"
                mirror={!isLeft}
                tilt={inp.tib_rotation}
                refLines={false}
                cluster={<Cluster onRotate={(x) => bump('tib_rotation', x)} />}
              >
                <div className="flex justify-center">
                  <AngleBox label={inp.tib_rotation >= 0 ? 'External' : 'Internal'} value={inp.tib_rotation} />
                </div>
              </Cell>

              <Cell
                plane="Sagittal"
                bone="tibia"
                mirror={false}
                tilt={-inp.tib_slope}
                refLines={false}
                cluster={<Cluster onRotate={(x) => bump('tib_slope', x)} />}
              >
                <div className="flex justify-center">
                  <AngleBox label="P. Slope" value={inp.tib_slope} />
                </div>
              </Cell>
            </div>
          </div>
        </div>

        {/* right rail */}
        <div className="rounded-lg bg-[#1a1d22] p-2 text-xs">
          <p className="mb-2 rounded bg-black/40 px-2 py-1 font-semibold text-slate-200">
            Triathlon CS Primary (PCL Protect)
          </p>
          <RailStep label="Femur" prefix="Post. ▾" value={inp.fem_size} readOnly={readOnly} onStep={(x) => bump('fem_size', x)} />
          <RailStep label="Tibia" value={inp.tib_size} readOnly={readOnly} onStep={(x) => bump('tib_size', x)} />
          <RailStep label="Poly" value={inp.poly} readOnly={readOnly} onStep={(x) => bump('poly', x)} />

          <p className="mt-3 border-t border-slate-700 pt-2 text-slate-300">
            Operative Side: <span className="font-semibold text-slate-100">{inp.side}</span>
          </p>
          {!readOnly && (
            <div className="mt-1 flex gap-1">
              {(['left', 'right'] as const).map((s) => (
                <button
                  key={s}
                  className={`flex-1 rounded py-1 ${inp.side === s ? 'bg-lime-600 text-slate-900' : 'bg-black/40 text-slate-400'}`}
                  onClick={() => onChange?.({ ...values, side: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* computed summary */}
      <div dir="rtl" className="border-t border-slate-800 bg-[#12151a] p-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat
            label="יישור גפה כולל"
            value={`${signed(d.limbVarus, '°')} ${d.limbVarus >= 0 ? 'Varus' : 'Valgus'}`}
          />
          <Stat label="מרווח בהזדקפות" value={`${d.extGap.toFixed(1)} מ״מ`} />
          <Stat
            label="מרווח בכיפוף"
            value={`${d.flexGap.toFixed(1)} מ״מ (Δ ${signed(d.gapDiff, '')})`}
          />
        </div>
        {d.warnings.length > 0 && (
          <ul className="mt-2 space-y-1">
            {d.warnings.map((w) => (
              <li key={w} className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle size={12} />
                {w}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          ⟲ ⟳ מסובבים את הרכיב (וארוס/ולגוס, סיבוב, כיפוף, שיפוע). − / + משנים
          את עומק החיתוך. הערכים הצדדיים (L/M), המרווחים והיישור מחושבים
          אוטומטית מהאנטומיה.
        </p>
      </div>
    </div>
  )
}
