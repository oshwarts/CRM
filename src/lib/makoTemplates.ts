// MAKO-style pre-op planning templates.
// `grid` recreates the robot's Case-Planning view (rows of anatomical cells, each
// with a bone illustration + value controls). `extras` holds the remaining setup
// fields (implant system, alignment, sizes, gap balance, notes).

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

export type MakoCell = {
  svg: string
  caption: string
  top?: MakoField[]
  bottom?: MakoField[]
}

export type MakoSection = {
  title: string
  columns?: 2 | 3
  fields: MakoField[]
}

export type MakoTemplate = {
  id: 'mako_tka' | 'mako_pka' | 'mako_tha'
  label: string
  rowLabels: string[]
  grid: MakoCell[][]
  extras: MakoSection[]
}

const NOTES: MakoSection = {
  title: 'העדפות מנתח / הערות',
  fields: [{ key: 'surgeon_notes', label: 'הערות חופשיות', type: 'textarea' }],
}

/* ------------------------------------------------------------------ TKA */

const tka: MakoTemplate = {
  id: 'mako_tka',
  label: 'MAKO – החלפת ברך מלאה',
  rowLabels: ['עצם הירך · Femur', 'עצם השוק · Tibia'],
  grid: [
    [
      {
        svg: 'femur-coronal',
        caption: 'Coronal',
        top: [{ key: 'fem_varus', label: 'Varus / Valgus', type: 'stepper', unit: '°', step: 0.5, default: 0 }],
        bottom: [
          { key: 'fem_distal_med', label: 'M', type: 'stepper', unit: 'mm', step: 0.5, default: 8 },
          { key: 'fem_distal_lat', label: 'L', type: 'stepper', unit: 'mm', step: 0.5, default: 8 },
        ],
      },
      {
        svg: 'femur-axial',
        caption: 'Axial',
        top: [{ key: 'fem_rotation', label: 'External', type: 'stepper', unit: '°', step: 0.5, default: 0 }],
        bottom: [
          { key: 'fem_post_med', label: 'M', type: 'stepper', unit: 'mm', step: 0.5, default: 8 },
          { key: 'fem_post_lat', label: 'L', type: 'stepper', unit: 'mm', step: 0.5, default: 7 },
        ],
      },
      {
        svg: 'femur-sagittal',
        caption: 'Sagittal',
        top: [{ key: 'fem_flexion', label: 'Flexion', type: 'stepper', unit: '°', step: 0.5, default: 3 }],
      },
    ],
    [
      {
        svg: 'tibia-coronal',
        caption: 'Coronal',
        bottom: [{ key: 'tib_varus', label: 'Varus / Valgus', type: 'stepper', unit: '°', step: 0.5, default: 0 }],
      },
      {
        svg: 'tibia-axial',
        caption: 'Axial',
        bottom: [{ key: 'tib_rotation', label: 'External', type: 'stepper', unit: '°', step: 0.5, default: 0 }],
      },
      {
        svg: 'tibia-sagittal',
        caption: 'Sagittal',
        bottom: [{ key: 'tib_slope', label: 'P. Slope', type: 'stepper', unit: '°', step: 0.5, default: 3 }],
      },
    ],
  ],
  extras: [
    {
      title: 'מערכת ויישור',
      columns: 3,
      fields: [
        {
          key: 'implant_system',
          label: 'מערכת שתל',
          type: 'select',
          options: [
            'Triathlon CR',
            'Triathlon PS',
            'Triathlon CS',
            'Triathlon TS',
            'Triathlon Cementless CR',
            'Triathlon Cementless PS',
          ],
          default: 'Triathlon CR',
        },
        {
          key: 'alignment',
          label: 'פילוסופיית יישור',
          type: 'select',
          options: ['Mechanical', 'Adjusted Mechanical', 'Kinematic', 'Restricted Kinematic', 'Functional'],
          default: 'Mechanical',
        },
        {
          key: 'patella',
          label: 'פיקה',
          type: 'select',
          options: ['Resurface', 'Non-resurface', 'Selective'],
          default: 'Resurface',
        },
        {
          key: 'approach',
          label: 'גישה ניתוחית',
          type: 'select',
          options: ['Medial Parapatellar', 'Subvastus', 'Midvastus', 'Quad-sparing'],
          default: 'Medial Parapatellar',
        },
        { key: 'fem_size', label: 'מידת רכיב Femur', type: 'text' },
        { key: 'tib_size', label: 'מידת רכיב Tibia', type: 'text' },
        {
          key: 'insert_thickness',
          label: 'עובי אינסרט (mm)',
          type: 'select',
          options: ['9', '11', '13', '16', '19'],
          default: '9',
        },
        { key: 'tib_resection_med', label: 'חיתוך Tibia מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 2 },
        { key: 'tib_resection_lat', label: 'חיתוך Tibia לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 6 },
      ],
    },
    {
      title: 'איזון מרווחים (Gap Balance)',
      columns: 2,
      fields: [
        { key: 'ext_gap_med', label: 'הזדקפות – מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 18 },
        { key: 'ext_gap_lat', label: 'הזדקפות – לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 18 },
        { key: 'flex_gap_med', label: 'כיפוף 90° – מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 18 },
        { key: 'flex_gap_lat', label: 'כיפוף 90° – לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 19 },
      ],
    },
    NOTES,
  ],
}

/* ------------------------------------------------------------------ PKA */

const pka: MakoTemplate = {
  id: 'mako_pka',
  label: 'MAKO – החלפת ברך חלקית / יוני',
  rowLabels: ['עצם הירך · Femur (Onlay)', 'עצם השוק · Tibia'],
  grid: [
    [
      {
        svg: 'femur-coronal',
        caption: 'Coronal',
        top: [{ key: 'fem_flexion', label: 'Flexion', type: 'stepper', unit: '°', step: 0.5, default: 5 }],
        bottom: [{ key: 'fem_resection', label: 'Resection', type: 'stepper', unit: 'mm', step: 0.5, default: 5 }],
      },
      {
        svg: 'femur-axial',
        caption: 'Axial',
        top: [{ key: 'fem_rotation', label: 'Rotation', type: 'stepper', unit: '°', step: 0.5, default: 0 }],
      },
    ],
    [
      {
        svg: 'tibia-coronal',
        caption: 'Coronal',
        bottom: [{ key: 'tib_resection', label: 'Resection', type: 'stepper', unit: 'mm', step: 0.5, default: 4 }],
      },
      {
        svg: 'tibia-sagittal',
        caption: 'Sagittal',
        bottom: [{ key: 'tib_slope', label: 'P. Slope', type: 'stepper', unit: '°', step: 0.5, default: 5 }],
      },
    ],
  ],
  extras: [
    {
      title: 'מערכת',
      columns: 3,
      fields: [
        { key: 'compartment', label: 'מדור', type: 'select', options: ['מדיאלי', 'לטרלי', 'פטלו-פמורלי'], default: 'מדיאלי' },
        {
          key: 'implant_system',
          label: 'מערכת שתל',
          type: 'select',
          options: ['Restoris MCK Onlay', 'Restoris MCK Inlay'],
          default: 'Restoris MCK Onlay',
        },
        { key: 'fixation', label: 'קיבוע', type: 'select', options: ['Cemented', 'Cementless'], default: 'Cemented' },
        { key: 'approach', label: 'גישה', type: 'select', options: ['Minimally Invasive (MIS)', 'Medial Parapatellar'], default: 'Minimally Invasive (MIS)' },
        { key: 'tib_rotation', label: 'Tibia Rotation', type: 'stepper', unit: '°', step: 0.5, default: 0 },
        {
          key: 'insert_thickness',
          label: 'עובי אינסרט (mm)',
          type: 'select',
          options: ['8', '9', '10', '11', '12'],
          default: '8',
        },
        { key: 'alignment_target', label: 'יעד יישור שיורי', type: 'text', default: '' },
        { key: 'fem_size', label: 'מידת רכיב Femur', type: 'text' },
        { key: 'tib_size', label: 'מידת רכיב Tibia', type: 'text' },
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

/* ------------------------------------------------------------------ THA */

const tha: MakoTemplate = {
  id: 'mako_tha',
  label: 'MAKO – החלפת מפרק ירך',
  rowLabels: ['גביע · Acetabular Cup', 'גזע · Femoral Stem'],
  grid: [
    [
      {
        svg: 'pelvis-coronal',
        caption: 'Coronal',
        top: [{ key: 'cup_inclination', label: 'Inclination', type: 'stepper', unit: '°', step: 1, default: 40 }],
        bottom: [{ key: 'cup_size', label: 'Cup', type: 'stepper', unit: 'mm', step: 2, default: 54 }],
      },
      {
        svg: 'pelvis-axial',
        caption: 'Axial',
        top: [{ key: 'cup_anteversion', label: 'Anteversion', type: 'stepper', unit: '°', step: 1, default: 20 }],
      },
      {
        svg: 'hip-center',
        caption: 'Center of Rotation',
        bottom: [
          { key: 'cor_medial', label: 'מדיאלי/לטרלי', type: 'stepper', unit: 'mm', step: 1, default: 0 },
          { key: 'cor_superior', label: 'עליון/תחתון', type: 'stepper', unit: 'mm', step: 1, default: 0 },
        ],
      },
    ],
    [
      {
        svg: 'femur-ap-stem',
        caption: 'AP',
        top: [{ key: 'stem_anteversion', label: 'Anteversion', type: 'stepper', unit: '°', step: 1, default: 15 }],
        bottom: [{ key: 'femoral_offset_change', label: 'Δ Offset', type: 'stepper', unit: 'mm', step: 1, default: 0 }],
      },
      {
        svg: 'femur-length',
        caption: 'Leg Length',
        bottom: [{ key: 'leg_length_change', label: 'Δ אורך גפה', type: 'stepper', unit: 'mm', step: 1, default: 0 }],
      },
      {
        svg: 'hip-combined',
        caption: 'Combined Anteversion',
        bottom: [{ key: 'combined_anteversion', label: 'Cup + Stem', type: 'stepper', unit: '°', step: 1, default: 35 }],
      },
    ],
  ],
  extras: [
    {
      title: 'גישה ומערכת',
      columns: 3,
      fields: [
        { key: 'approach', label: 'גישה ניתוחית', type: 'select', options: ['אחורית', 'קדמית (DAA)', 'אנטרו-לטרלית', 'לטרלית (Hardinge)'], default: 'אחורית' },
        { key: 'cup_system', label: 'מערכת גביע', type: 'select', options: ['Trident II', 'Trident', 'Tritanium'], default: 'Trident II' },
        { key: 'stem_system', label: 'מערכת גזע', type: 'select', options: ['Accolade II', 'Accolade', 'Exeter', 'Restoration Modular'], default: 'Accolade II' },
        { key: 'bearing', label: 'משטח נשיאה', type: 'select', options: ['PE מצולב (X3)', 'Dual Mobility', 'Ceramic-on-Ceramic'], default: 'PE מצולב (X3)' },
        { key: 'head_size', label: 'קוטר ראש (mm)', type: 'select', options: ['28', '32', '36', '40'], default: '36' },
        { key: 'head_length', label: 'אורך ראש', type: 'select', options: ['-4', '0', '+4', '+8', '+12'], default: '0' },
        { key: 'neck_offset', label: 'Offset צוואר', type: 'select', options: ['Standard', 'High Offset', 'Coxa Vara'], default: 'Standard' },
        { key: 'stem_size', label: 'מידת גזע', type: 'text' },
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

export function defaultsFor(t: MakoTemplate): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  const take = (f: MakoField) => {
    if (f.type === 'stepper') out[f.key] = f.default
    else if (f.type === 'select') out[f.key] = f.default
    else if (f.default != null) out[f.key] = f.default
  }
  for (const row of t.grid)
    for (const cell of row) {
      cell.top?.forEach(take)
      cell.bottom?.forEach(take)
    }
  for (const s of t.extras) s.fields.forEach(take)
  return out
}
