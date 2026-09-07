// MAKO SmartRobotics "Case Planning" style templates.
//   - 'quad'  : RESTORIS MCK partial knee — Transverse / 3D / Coronal / Sagittal,
//               Implant-View toggle, blue right rail (Size / Poly / Proud).
//   - 'knee'  : Triathlon total knee — a small biomechanical model (see
//               kneeModel.ts) rendered as the 2x3 Femur/Tibia Case-Planning grid.
import { KNEE_DEFAULTS } from './kneeModel'

/* ============================== shared ============================== */

export type MakoField =
  | {
      key: string
      label: string
      sub?: string
      type: 'stepper'
      unit: '°' | 'mm'
      step: number
      default: number
    }
  | { key: string; label: string; type: 'select'; options: string[]; default: string }
  | { key: string; label: string; type: 'text'; default?: string }
  | { key: string; label: string; type: 'textarea'; default?: string }

export type MakoSection = { title: string; columns?: 2 | 3; fields: MakoField[] }

const NOTES: MakoSection = {
  title: 'העדפות מנתח / הערות',
  fields: [{ key: 'surgeon_notes', label: 'הערות חופשיות', type: 'textarea' }],
}

/* ============================== quad ============================== */

export type QuadField = {
  key: string
  unit: '°' | 'mm'
  step: number
  default: number
  posLabel: string
  negLabel: string
}

export type PanelField =
  | { key: string; label: string; type: 'select'; options: string[]; default: string }
  | { key: string; label: string; type: 'proud'; step: number; default: number }
  | { key: string; label: string; type: 'text'; default?: string }

export type MakoComponentView = {
  id: string
  label: string
  bone: 'tibia' | 'femur' | 'pelvis'
  transverse: QuadField
  coronal: QuadField
  sagittal: QuadField
  panel: PanelField[]
}

/* ============================== grid ============================== */

export type CellValue =
  | {
      kind: 'angle'
      key: string
      posLabel: string
      negLabel: string
      ref?: string
      step: number
      default: number
    }
  | { kind: 'mm'; key: string; label: string; step: number; default: number }

export type GridCell = {
  bone: 'femur' | 'tibia'
  plane: 'coronal' | 'axial' | 'sagittal'
  top?: CellValue[]
  bottom?: CellValue[]
}

export type GridRow = { label: string; cells: GridCell[] }

export type RailStepper = { key: string; label: string; default: number; prefix?: string }

export type MakoTemplate = {
  id: 'mako_tka' | 'mako_pka' | 'mako_tha'
  label: string
  layout: 'quad' | 'grid' | 'knee'
  greenHeader: string
  // quad
  components?: MakoComponentView[]
  // grid
  rows?: GridRow[]
  rail?: RailStepper[]
  extras: MakoSection[]
}

/* --------------------------- quad helpers --------------------------- */

const rot = (key: string, def = 0): QuadField => ({
  key,
  unit: '°',
  step: 0.5,
  default: def,
  posLabel: 'External',
  negLabel: 'Internal',
})
const varus = (key: string, def = 0): QuadField => ({
  key,
  unit: '°',
  step: 0.5,
  default: def,
  posLabel: 'Varus',
  negLabel: 'Valgus',
})
const slope = (key: string, label: string, def: number): QuadField => ({
  key,
  unit: '°',
  step: 0.5,
  default: def,
  posLabel: label,
  negLabel: label,
})

/* ============================== PKA (quad) ============================== */

const pka: MakoTemplate = {
  id: 'mako_pka',
  layout: 'quad',
  label: 'MAKO – החלפת ברך חלקית / יוני',
  greenHeader: 'RESTORIS® MCK Medial Onlay PKA',
  components: [
    {
      id: 'femur',
      label: 'Medial Femur – Primary',
      bone: 'femur',
      transverse: rot('fem_rotation', 1.5),
      coronal: varus('fem_varus', 0),
      sagittal: slope('fem_flexion', 'Flexion', 5),
      panel: [
        { key: 'fem_size', label: 'Size', type: 'select', options: ['1', '2', '3', '4', '5', '6', '7'], default: '5' },
        { key: 'fem_poly', label: 'Poly', type: 'select', options: ['8.0 mm', '10.0 mm', '12.0 mm'], default: '8.0 mm' },
        { key: 'fem_proud', label: 'Proud', type: 'proud', step: 0.2, default: 2.4 },
      ],
    },
    {
      id: 'tibia',
      label: 'Medial Tibia – Primary',
      bone: 'tibia',
      transverse: rot('tib_rotation', 0.1),
      coronal: varus('tib_varus', 1),
      sagittal: slope('tib_slope', 'P. Slope', 7),
      panel: [
        { key: 'tib_size', label: 'Size', type: 'select', options: ['1', '2', '3', '4', '5', '6', '7'], default: '6' },
        { key: 'tib_poly', label: 'Poly', type: 'select', options: ['8.0 mm', '10.0 mm', '12.0 mm'], default: '8.0 mm' },
        { key: 'tib_proud', label: 'Proud', type: 'proud', step: 0.2, default: 3.0 },
      ],
    },
  ],
  extras: [
    {
      title: 'מערכת ויישור',
      columns: 3,
      fields: [
        { key: 'compartment', label: 'מדור', type: 'select', options: ['מדיאלי', 'לטרלי', 'פטלו-פמורלי'], default: 'מדיאלי' },
        { key: 'operative_side', label: 'צד מנותח', type: 'select', options: ['left', 'right'], default: 'left' },
        { key: 'implant_system', label: 'מערכת שתל', type: 'select', options: ['Restoris MCK Onlay', 'Restoris MCK Inlay'], default: 'Restoris MCK Onlay' },
        { key: 'fixation', label: 'קיבוע', type: 'select', options: ['Cemented', 'Cementless'], default: 'Cemented' },
        { key: 'approach', label: 'גישה', type: 'select', options: ['Minimally Invasive (MIS)', 'Medial Parapatellar'], default: 'Minimally Invasive (MIS)' },
        { key: 'alignment_target', label: 'יעד יישור שיורי', type: 'text', default: '' },
      ],
    },
    {
      title: 'איזון רצועות בטווח תנועה',
      columns: 3,
      fields: [
        { key: 'gap_extension', label: 'הזדקפות', type: 'stepper', unit: 'mm', step: 0.5, default: 0 },
        { key: 'gap_midflexion', label: 'כיפוף אמצע', type: 'stepper', unit: 'mm', step: 0.5, default: 0 },
        { key: 'gap_flexion', label: 'כיפוף מלא', type: 'stepper', unit: 'mm', step: 0.5, default: 0 },
      ],
    },
    NOTES,
  ],
}

/* ============================== TKA (knee model) ============================== */

const tka: MakoTemplate = {
  id: 'mako_tka',
  layout: 'knee',
  label: 'MAKO – החלפת ברך מלאה',
  greenHeader: 'Triathlon CS Primary (PCL Protect)',
  extras: [
    {
      title: 'מערכת ויישור',
      columns: 3,
      fields: [
        { key: 'implant_system', label: 'מערכת שתל', type: 'select', options: ['Triathlon CR', 'Triathlon PS', 'Triathlon CS', 'Triathlon TS', 'Triathlon Cementless CR', 'Triathlon Cementless PS'], default: 'Triathlon CS' },
        { key: 'alignment', label: 'פילוסופיית יישור', type: 'select', options: ['Mechanical', 'Adjusted Mechanical', 'Kinematic', 'Restricted Kinematic', 'Functional'], default: 'Mechanical' },
        { key: 'patella', label: 'פיקה', type: 'select', options: ['Resurface', 'Non-resurface', 'Selective'], default: 'Resurface' },
        { key: 'approach', label: 'גישה ניתוחית', type: 'select', options: ['Medial Parapatellar', 'Subvastus', 'Midvastus', 'Quad-sparing'], default: 'Medial Parapatellar' },
        { key: 'fem_rotation_ref', label: 'ייחוס סיבוב Femur', type: 'select', options: ['PCA', 'TEA', 'Whiteside', 'Balanced'], default: 'Balanced' },
        { key: 'cr_pcl', label: 'CR / PS', type: 'select', options: ['CR (PCL Retain)', 'CS (PCL Protect)', 'PS (PCL Substitute)'], default: 'CS (PCL Protect)' },
      ],
    },
    {
      title: 'אנטומיית מטופל (מתקדם)',
      columns: 2,
      fields: [
        { key: 'aa_ma_offset', label: 'הפרש AA–MA (°)', type: 'stepper', unit: '°', step: 0.5, default: 6.7 },
        { key: 'pca_tea_offset', label: 'הפרש PCA–TEA (°)', type: 'stepper', unit: '°', step: 0.5, default: 4.5 },
      ],
    },
    NOTES,
  ],
}

/* ============================== THA (quad) ============================== */

const tha: MakoTemplate = {
  id: 'mako_tha',
  layout: 'quad',
  label: 'MAKO – החלפת מפרק ירך',
  greenHeader: 'MAKO Total Hip',
  components: [
    {
      id: 'cup',
      label: 'Acetabular Cup',
      bone: 'pelvis',
      transverse: { key: 'cup_anteversion', unit: '°', step: 1, default: 20, posLabel: 'Anteversion', negLabel: 'Retroversion' },
      coronal: { key: 'cup_inclination', unit: '°', step: 1, default: 40, posLabel: 'Inclination', negLabel: 'Inclination' },
      sagittal: { key: 'cup_tilt', unit: '°', step: 1, default: 0, posLabel: 'Tilt', negLabel: 'Tilt' },
      panel: [
        { key: 'cup_size', label: 'Size', type: 'select', options: ['46', '48', '50', '52', '54', '56', '58', '60', '62'], default: '54' },
        { key: 'liner', label: 'Liner', type: 'select', options: ['Neutral', 'Hooded 10°', 'Face-changing'], default: 'Neutral' },
        { key: 'cup_system', label: 'System', type: 'select', options: ['Trident II', 'Trident', 'Tritanium'], default: 'Trident II' },
      ],
    },
    {
      id: 'stem',
      label: 'Femoral Stem',
      bone: 'femur',
      transverse: { key: 'stem_anteversion', unit: '°', step: 1, default: 15, posLabel: 'Anteversion', negLabel: 'Retroversion' },
      coronal: { key: 'femoral_offset_change', unit: 'mm', step: 1, default: 0, posLabel: 'Offset +', negLabel: 'Offset −' },
      sagittal: { key: 'leg_length_change', unit: 'mm', step: 1, default: 0, posLabel: 'LL +', negLabel: 'LL −' },
      panel: [
        { key: 'stem_size', label: 'Size', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], default: '3' },
        { key: 'head_size', label: 'Head', type: 'select', options: ['28 mm', '32 mm', '36 mm', '40 mm'], default: '36 mm' },
        { key: 'head_length', label: 'Head Length', type: 'select', options: ['-4', '0', '+4', '+8', '+12'], default: '0' },
        { key: 'neck_offset', label: 'Neck', type: 'select', options: ['Standard', 'High Offset', 'Coxa Vara'], default: 'Standard' },
      ],
    },
  ],
  extras: [
    {
      title: 'גישה ומערכת',
      columns: 3,
      fields: [
        { key: 'operative_side', label: 'צד מנותח', type: 'select', options: ['left', 'right'], default: 'left' },
        { key: 'approach', label: 'גישה ניתוחית', type: 'select', options: ['אחורית', 'קדמית (DAA)', 'אנטרו-לטרלית', 'לטרלית (Hardinge)'], default: 'אחורית' },
        { key: 'stem_system', label: 'מערכת גזע', type: 'select', options: ['Accolade II', 'Accolade', 'Exeter', 'Restoration Modular'], default: 'Accolade II' },
        { key: 'bearing', label: 'משטח נשיאה', type: 'select', options: ['PE מצולב (X3)', 'Dual Mobility', 'Ceramic-on-Ceramic'], default: 'PE מצולב (X3)' },
        { key: 'combined_anteversion', label: 'Combined Anteversion', type: 'stepper', unit: '°', step: 1, default: 35 },
        { key: 'cup_reference', label: 'מישור ייחוס', type: 'select', options: ['Anterior Pelvic Plane', 'Functional / Supine', 'Native'], default: 'Anterior Pelvic Plane' },
      ],
    },
    NOTES,
  ],
}

export const MAKO_TEMPLATES: Record<string, MakoTemplate> = {
  mako_tka: tka,
  mako_pka: pka,
  mako_tha: tha,
}

export function templateFor(key: string | null | undefined): MakoTemplate | null {
  if (!key || key === 'generic') return null
  return MAKO_TEMPLATES[key] ?? null
}

export function componentFieldKey(componentId: string, key: string): string {
  return `${componentId}__${key}`
}

export function defaultsFor(t: MakoTemplate): Record<string, string | number> {
  const out: Record<string, string | number> = {}

  if (t.layout === 'knee') {
    Object.assign(out, KNEE_DEFAULTS)
  } else if (t.layout === 'quad') {
    for (const c of t.components ?? []) {
      out[componentFieldKey(c.id, c.transverse.key)] = c.transverse.default
      out[componentFieldKey(c.id, c.coronal.key)] = c.coronal.default
      out[componentFieldKey(c.id, c.sagittal.key)] = c.sagittal.default
      for (const p of c.panel) {
        if (p.type === 'select' || p.type === 'proud')
          out[componentFieldKey(c.id, p.key)] = p.default
        else if (p.default != null) out[componentFieldKey(c.id, p.key)] = p.default
      }
    }
  } else {
    for (const row of t.rows ?? [])
      for (const cell of row.cells)
        for (const v of [...(cell.top ?? []), ...(cell.bottom ?? [])])
          out[v.key] = v.default
    for (const s of t.rail ?? []) out[s.key] = s.default
  }

  for (const s of t.extras)
    for (const f of s.fields) {
      if (f.type === 'stepper' || f.type === 'select') out[f.key] = f.default
      else if (f.default != null) out[f.key] = f.default
    }
  return out
}
