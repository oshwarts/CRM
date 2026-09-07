// MAKO-style pre-op planning templates. Each procedure with a non-"generic"
// planning_template renders these structured panels (Femur / Tibia / Gaps, or
// Cup / Stem for hip), styled to resemble the robot's Case Planning screen.

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

export type MakoSection = {
  title: string
  columns?: 2 | 3
  fields: MakoField[]
}

export type MakoTemplate = {
  id: 'mako_tka' | 'mako_pka' | 'mako_tha'
  label: string
  sections: MakoSection[]
}

const NOTES: MakoSection = {
  title: 'העדפות מנתח / הערות',
  fields: [
    { key: 'surgeon_notes', label: 'הערות חופשיות', type: 'textarea' },
  ],
}

export const MAKO_TEMPLATES: Record<string, MakoTemplate> = {
  mako_tka: {
    id: 'mako_tka',
    label: 'MAKO – החלפת ברך מלאה (Total Knee)',
    sections: [
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
            options: [
              'Mechanical',
              'Adjusted Mechanical',
              'Kinematic',
              'Restricted Kinematic',
              'Functional',
            ],
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
        ],
      },
      {
        title: 'עצם הירך (Femur)',
        columns: 3,
        fields: [
          { key: 'fem_varus', label: 'Varus / Valgus', type: 'stepper', unit: '°', step: 0.5, default: 0 },
          { key: 'fem_rotation', label: 'External Rotation', type: 'stepper', unit: '°', step: 0.5, default: 0 },
          { key: 'fem_flexion', label: 'Flexion', type: 'stepper', unit: '°', step: 0.5, default: 3 },
          { key: 'fem_distal_med', label: 'חיתוך דיסטלי', sub: 'מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 8 },
          { key: 'fem_distal_lat', label: 'חיתוך דיסטלי', sub: 'לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 8 },
          { key: 'fem_size', label: 'מידת רכיב', type: 'text' },
          { key: 'fem_post_med', label: 'חיתוך אחורי', sub: 'מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 8 },
          { key: 'fem_post_lat', label: 'חיתוך אחורי', sub: 'לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 7 },
        ],
      },
      {
        title: 'עצם השוק (Tibia)',
        columns: 3,
        fields: [
          { key: 'tib_varus', label: 'Varus / Valgus', type: 'stepper', unit: '°', step: 0.5, default: 0 },
          { key: 'tib_rotation', label: 'External Rotation', type: 'stepper', unit: '°', step: 0.5, default: 0 },
          { key: 'tib_slope', label: 'Posterior Slope', type: 'stepper', unit: '°', step: 0.5, default: 3 },
          { key: 'tib_resection_med', label: 'חיתוך', sub: 'מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 2 },
          { key: 'tib_resection_lat', label: 'חיתוך', sub: 'לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 6 },
          {
            key: 'insert_thickness',
            label: 'עובי אינסרט',
            type: 'select',
            options: ['9', '11', '13', '16', '19'],
            default: '9',
          },
          { key: 'tib_size', label: 'מידת רכיב', type: 'text' },
        ],
      },
      {
        title: 'איזון מרווחים (Gap Balance)',
        columns: 2,
        fields: [
          { key: 'ext_gap_med', label: 'מרווח בהזדקפות', sub: 'מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 18 },
          { key: 'ext_gap_lat', label: 'מרווח בהזדקפות', sub: 'לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 18 },
          { key: 'flex_gap_med', label: 'מרווח בכיפוף 90°', sub: 'מדיאלי', type: 'stepper', unit: 'mm', step: 0.5, default: 18 },
          { key: 'flex_gap_lat', label: 'מרווח בכיפוף 90°', sub: 'לטרלי', type: 'stepper', unit: 'mm', step: 0.5, default: 19 },
        ],
      },
      NOTES,
    ],
  },

  mako_pka: {
    id: 'mako_pka',
    label: 'MAKO – החלפת ברך חלקית / יוני (Partial Knee)',
    sections: [
      {
        title: 'מערכת',
        columns: 3,
        fields: [
          {
            key: 'compartment',
            label: 'מדור',
            type: 'select',
            options: ['מדיאלי', 'לטרלי', 'פטלו-פמורלי'],
            default: 'מדיאלי',
          },
          {
            key: 'implant_system',
            label: 'מערכת שתל',
            type: 'select',
            options: ['Restoris MCK Onlay', 'Restoris MCK Inlay'],
            default: 'Restoris MCK Onlay',
          },
          {
            key: 'fixation',
            label: 'קיבוע',
            type: 'select',
            options: ['Cemented', 'Cementless'],
            default: 'Cemented',
          },
          {
            key: 'approach',
            label: 'גישה',
            type: 'select',
            options: ['Minimally Invasive (MIS)', 'Medial Parapatellar'],
            default: 'Minimally Invasive (MIS)',
          },
          { key: 'alignment_target', label: 'יעד יישור שיורי', type: 'text', default: '' },
        ],
      },
      {
        title: 'עצם הירך (Femur – Onlay)',
        columns: 3,
        fields: [
          { key: 'fem_flexion', label: 'Flexion', type: 'stepper', unit: '°', step: 0.5, default: 5 },
          { key: 'fem_rotation', label: 'Rotation', type: 'stepper', unit: '°', step: 0.5, default: 0 },
          { key: 'fem_resection', label: 'עומק חיתוך', type: 'stepper', unit: 'mm', step: 0.5, default: 5 },
          { key: 'fem_size', label: 'מידת רכיב', type: 'text' },
        ],
      },
      {
        title: 'עצם השוק (Tibia)',
        columns: 3,
        fields: [
          { key: 'tib_slope', label: 'Posterior Slope', type: 'stepper', unit: '°', step: 0.5, default: 5 },
          { key: 'tib_rotation', label: 'Rotation', type: 'stepper', unit: '°', step: 0.5, default: 0 },
          { key: 'tib_resection', label: 'עומק חיתוך', type: 'stepper', unit: 'mm', step: 0.5, default: 4 },
          {
            key: 'insert_thickness',
            label: 'עובי אינסרט',
            type: 'select',
            options: ['8', '9', '10', '11', '12'],
            default: '8',
          },
          { key: 'tib_size', label: 'מידת רכיב', type: 'text' },
        ],
      },
      {
        title: 'איזון רצועות',
        columns: 3,
        fields: [
          { key: 'gap_extension', label: 'מרווח בהזדקפות', type: 'stepper', unit: 'mm', step: 0.5, default: 0 },
          { key: 'gap_midflexion', label: 'מרווח בכיפוף אמצע', type: 'stepper', unit: 'mm', step: 0.5, default: 0 },
          { key: 'gap_flexion', label: 'מרווח בכיפוף מלא', type: 'stepper', unit: 'mm', step: 0.5, default: 0 },
        ],
      },
      NOTES,
    ],
  },

  mako_tha: {
    id: 'mako_tha',
    label: 'MAKO – החלפת מפרק ירך (Total Hip)',
    sections: [
      {
        title: 'גישה ומערכת',
        columns: 3,
        fields: [
          {
            key: 'approach',
            label: 'גישה ניתוחית',
            type: 'select',
            options: ['אחורית', 'קדמית (DAA)', 'אנטרו-לטרלית', 'לטרלית (Hardinge)'],
            default: 'אחורית',
          },
          {
            key: 'cup_system',
            label: 'מערכת גביע',
            type: 'select',
            options: ['Trident II', 'Trident', 'Tritanium'],
            default: 'Trident II',
          },
          {
            key: 'stem_system',
            label: 'מערכת גזע',
            type: 'select',
            options: ['Accolade II', 'Accolade', 'Exeter', 'Restoration Modular'],
            default: 'Accolade II',
          },
          {
            key: 'bearing',
            label: 'משטח נשיאה',
            type: 'select',
            options: ['PE מצולב (X3)', 'Dual Mobility', 'Ceramic-on-Ceramic'],
            default: 'PE מצולב (X3)',
          },
          {
            key: 'head_size',
            label: 'קוטר ראש',
            type: 'select',
            options: ['28', '32', '36', '40'],
            default: '36',
          },
        ],
      },
      {
        title: 'גביע (Acetabular Cup)',
        columns: 3,
        fields: [
          { key: 'cup_inclination', label: 'Inclination', type: 'stepper', unit: '°', step: 1, default: 40 },
          { key: 'cup_anteversion', label: 'Anteversion', type: 'stepper', unit: '°', step: 1, default: 20 },
          { key: 'cup_size', label: 'מידת גביע', type: 'stepper', unit: 'mm', step: 2, default: 54 },
          { key: 'cor_medial', label: 'מרכז סיבוב', sub: 'מדיאלי (+) / לטרלי (−)', type: 'stepper', unit: 'mm', step: 1, default: 0 },
          { key: 'cor_superior', label: 'מרכז סיבוב', sub: 'עליון (+) / תחתון (−)', type: 'stepper', unit: 'mm', step: 1, default: 0 },
          {
            key: 'cup_reference',
            label: 'מישור ייחוס',
            type: 'select',
            options: ['Anterior Pelvic Plane', 'Functional / Supine', 'Native'],
            default: 'Anterior Pelvic Plane',
          },
        ],
      },
      {
        title: 'גזע (Femoral Stem)',
        columns: 3,
        fields: [
          { key: 'stem_anteversion', label: 'Anteversion', type: 'stepper', unit: '°', step: 1, default: 15 },
          {
            key: 'neck_offset',
            label: 'Offset צוואר',
            type: 'select',
            options: ['Standard', 'High Offset', 'Coxa Vara'],
            default: 'Standard',
          },
          {
            key: 'head_length',
            label: 'אורך ראש',
            type: 'select',
            options: ['-4', '0', '+4', '+8', '+12'],
            default: '0',
          },
          { key: 'femoral_offset_change', label: 'שינוי Offset', sub: 'מול צד נגדי', type: 'stepper', unit: 'mm', step: 1, default: 0 },
          { key: 'leg_length_change', label: 'שינוי אורך גפה', sub: 'מול צד נגדי', type: 'stepper', unit: 'mm', step: 1, default: 0 },
          { key: 'combined_anteversion', label: 'Combined Anteversion', sub: 'גביע + גזע', type: 'stepper', unit: '°', step: 1, default: 35 },
        ],
      },
      NOTES,
    ],
  },
}

export function templateFor(key: string | null | undefined): MakoTemplate | null {
  if (!key || key === 'generic') return null
  return MAKO_TEMPLATES[key] ?? null
}

export function defaultsFor(t: MakoTemplate): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const s of t.sections)
    for (const f of s.fields) {
      if (f.type === 'stepper') out[f.key] = f.default
      else if (f.type === 'select') out[f.key] = f.default
      else if (f.default != null) out[f.key] = f.default
    }
  return out
}
