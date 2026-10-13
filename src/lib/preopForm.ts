// Clean pre-op planning forms for the three MAKO procedures. Every value is a
// pick-from-list (no steppers, no drawings). Field keys are kept identical to
// the previous MAKO screens so plans that were already saved still load.

export type Opt = { value: string; label: string }
export type FormField = { key: string; label: string; options: Opt[] }
export type FormBlock = { sub?: string; fields: FormField[] }
/** rows (Femur / Tibia) × planes (Coronal / Transverse / Sagittal); each cell holds the values that belong to that plane */
export type PlaneTable = { planes: string[]; rows: { name: string; cells: FormField[][] }[] }
export type FormGroup = { title: string; blocks: FormBlock[]; planeTable?: PlaneTable }
export type PreopSchema = {
  id: 'mako_tka' | 'mako_tha' | 'mako_pka'
  short: string
  label: string
  groups: FormGroup[]
}

const n = (x: number) => String(+x.toFixed(2))

const list = (...v: string[]): Opt[] => v.map((x) => ({ value: x, label: x }))

function range(min: number, max: number, step: number, unit = ''): Opt[] {
  const out: Opt[] = []
  for (let v = min; v <= max + 1e-9; v += step)
    out.push({ value: n(v), label: `${n(v)}${unit}` })
  return out
}

// positive values get `pos`, negative values `neg`, e.g. "Valgus 3°"
function signed(min: number, max: number, step: number, unit: string, pos: string, neg: string): Opt[] {
  return range(min, max, step).map(({ value }) => {
    const v = Number(value)
    const word = v > 0 ? pos : v < 0 ? neg : ''
    return { value, label: `${word ? `${word} ` : ''}${n(Math.abs(v))}${unit}` }
  })
}

const f = (key: string, label: string, options: Opt[]): FormField => ({ key, label, options })

const SIDE: Opt[] = [
  { value: 'left', label: 'שמאל' },
  { value: 'right', label: 'ימין' },
]
const FIXATION = list('Cemented', 'Cementless', 'Hybrid')
const MM_CUT = range(3, 12, 0.5, ' מ״מ')
const GAP = signed(-4, 4, 0.5, ' מ״מ', 'פתוח', 'הדוק')

/* ============================== total knee ============================== */

const tka: PreopSchema = {
  id: 'mako_tka',
  short: 'ברך מלאה',
  label: 'MAKO – החלפת ברך מלאה',
  groups: [
    {
      title: 'מערכת שתל',
      blocks: [
        {
          fields: [
            f('implant_system', 'מערכת שתל', list('Triathlon CR', 'Triathlon PS', 'Triathlon CS', 'Triathlon TS', 'Triathlon Cementless CR', 'Triathlon Cementless PS')),
            f('patella', 'פיקה', list('Resurface', 'Non-resurface', 'Selective')),
          ],
        },
      ],
    },
    {
      title: 'יישור ותכנון לפי מישורים',
      blocks: [
        {
          fields: [f('alignment', 'פילוסופיית יישור', list('Mechanical', 'Adjusted Mechanical', 'Kinematic', 'Restricted Kinematic', 'Functional'))],
        },
      ],
      // the same layout as the MAKO planning screen: coronal | transverse | sagittal, femur above tibia
      planeTable: {
        planes: ['Coronal', 'Transverse', 'Sagittal'],
        rows: [
          {
            name: 'Femur',
            cells: [
              [
                f('fem_coronal_aa', 'Varus / Valgus — AA', signed(-6, 12, 0.5, '°', 'Valgus', 'Varus')),
                f('fem_coronal', 'Varus / Valgus — MA', signed(-6, 10, 0.5, '°', 'Valgus', 'Varus')),
                f('fem_distal_l', 'חיתוך דיסטלי — צד לטרלי (L)', MM_CUT),
                f('fem_distal_m', 'חיתוך דיסטלי — צד מדיאלי (M)', MM_CUT),
              ],
              [
                f('fem_rotation', 'סיבוב מול PCA', signed(-8, 8, 0.5, '°', 'External', 'Internal')),
                f('fem_rotation_tea', 'סיבוב מול TEA', signed(-8, 8, 0.5, '°', 'External', 'Internal')),
                f('fem_post_l', 'חיתוך אחורי — צד לטרלי (L)', MM_CUT),
                f('fem_post_m', 'חיתוך אחורי — צד מדיאלי (M)', MM_CUT),
              ],
              [f('fem_flexion', 'Flexion', signed(-3, 10, 0.5, '°', 'Flexion', 'Extension'))],
            ],
          },
          {
            name: 'Tibia',
            cells: [
              [
                f('tib_coronal', 'Varus / Valgus', signed(-6, 8, 0.5, '°', 'Varus', 'Valgus')),
                f('tib_resection', 'חיתוך Tibia', MM_CUT),
              ],
              [f('tib_rotation', 'סיבוב', signed(-8, 8, 0.5, '°', 'External', 'Internal'))],
              [f('tib_slope', 'P. Slope', range(0, 10, 0.5, '°'))],
            ],
          },
        ],
      },
    },
  ],
}

/* ============================== partial / uni knee ============================== */

const pka: PreopSchema = {
  id: 'mako_pka',
  short: 'יוני',
  label: 'MAKO – החלפת ברך חלקית / יוני',
  groups: [
    {
      title: 'מערכת שתל ומידות',
      blocks: [
        {
          fields: [
            f('implant_system', 'מערכת שתל', list('Restoris MCK Onlay', 'Restoris MCK Inlay')),
            f('compartment', 'מדור', list('מדיאלי', 'לטרלי', 'פטלו-פמורלי')),
          ],
        },
        {
          sub: 'Femur',
          fields: [
            f('femur__fem_size', 'מידה', range(1, 7, 1)),
            f('femur__fem_poly', 'Poly', list('8.0 mm', '10.0 mm', '12.0 mm')),
            f('femur__fem_proud', 'Proud (מ״מ)', range(0, 6, 0.2)),
          ],
        },
        {
          sub: 'Tibia',
          fields: [
            f('tibia__tib_size', 'מידה', range(1, 7, 1)),
            f('tibia__tib_poly', 'Poly', list('8.0 mm', '10.0 mm', '12.0 mm')),
            f('tibia__tib_proud', 'Proud (מ״מ)', range(0, 6, 0.2)),
          ],
        },
      ],
    },
    {
      title: 'זוויות והעדפות יישור',
      blocks: [
        {
          fields: [
            f('alignment_target', 'יעד יישור שיורי', signed(-6, 6, 1, '°', 'Valgus', 'Varus')),
          ],
        },
        {
          sub: 'Femur',
          fields: [
            f('femur__fem_varus', 'Varus / Valgus', signed(-6, 6, 0.5, '°', 'Varus', 'Valgus')),
            f('femur__fem_rotation', 'סיבוב', signed(-8, 8, 0.5, '°', 'External', 'Internal')),
            f('femur__fem_flexion', 'Flexion', signed(-3, 12, 0.5, '°', 'Flexion', 'Extension')),
          ],
        },
        {
          sub: 'Tibia',
          fields: [
            f('tibia__tib_varus', 'Varus / Valgus', signed(-6, 6, 0.5, '°', 'Varus', 'Valgus')),
            f('tibia__tib_rotation', 'סיבוב', signed(-8, 8, 0.5, '°', 'External', 'Internal')),
            f('tibia__tib_slope', 'P. Slope', range(0, 12, 0.5, '°')),
          ],
        },
        {
          sub: 'איזון רצועות',
          fields: [
            f('gap_extension', 'בהזדקפות', GAP),
            f('gap_midflexion', 'בכיפוף אמצע', GAP),
            f('gap_flexion', 'בכיפוף מלא', GAP),
          ],
        },
      ],
    },
    {
      title: 'גישה ניתוחית וקיבוע',
      blocks: [
        {
          fields: [
            f('operative_side', 'צד מנותח', SIDE),
            f('approach', 'גישה ניתוחית', list('Minimally Invasive (MIS)', 'Medial Parapatellar')),
            f('fixation', 'קיבוע', FIXATION),
          ],
        },
      ],
    },
  ],
}

/* ============================== total hip ============================== */

const tha: PreopSchema = {
  id: 'mako_tha',
  short: 'ירך',
  label: 'MAKO – החלפת מפרק ירך',
  groups: [
    {
      title: 'מערכת שתל ומידות',
      blocks: [
        {
          sub: 'Cup',
          fields: [
            f('cup__cup_system', 'מערכת', list('Trident II', 'Trident', 'Tritanium')),
            f('cup__cup_size', 'מידה', range(46, 62, 2)),
            f('cup__liner', 'Liner', list('Neutral', 'Hooded 10°', 'Face-changing')),
          ],
        },
        {
          sub: 'Stem',
          fields: [
            f('stem_system', 'מערכת', list('Accolade II', 'Accolade', 'Exeter', 'Restoration Modular')),
            f('stem__stem_size', 'מידה', range(0, 8, 1)),
            f('stem__head_size', 'Head', list('28 mm', '32 mm', '36 mm', '40 mm')),
            f('stem__head_length', 'אורך Head', list('-4', '0', '+4', '+8', '+12')),
            f('stem__neck_offset', 'Neck', list('Standard', 'High Offset', 'Coxa Vara')),
            f('bearing', 'משטח נשיאה', list('PE מצולב (X3)', 'Dual Mobility', 'Ceramic-on-Ceramic')),
          ],
        },
      ],
    },
    {
      title: 'זוויות והעדפות יישור',
      blocks: [
        {
          fields: [
            f('cup_reference', 'מישור ייחוס', list('Anterior Pelvic Plane', 'Functional / Supine', 'Native')),
            f('combined_anteversion', 'Combined Anteversion', range(20, 50, 1, '°')),
          ],
        },
        {
          sub: 'Cup',
          fields: [
            f('cup__cup_anteversion', 'Anteversion', signed(-10, 40, 1, '°', 'Anteversion', 'Retroversion')),
            f('cup__cup_inclination', 'Inclination', range(30, 55, 1, '°')),
            f('cup__cup_tilt', 'Tilt', range(-10, 20, 1, '°')),
          ],
        },
        {
          sub: 'Stem',
          fields: [
            f('stem__stem_anteversion', 'Anteversion', signed(-10, 40, 1, '°', 'Anteversion', 'Retroversion')),
            f('stem__femoral_offset_change', 'שינוי Offset', signed(-10, 10, 1, ' מ״מ', '+', '−')),
            f('stem__leg_length_change', 'שינוי אורך גפה', signed(-10, 10, 1, ' מ״מ', '+', '−')),
          ],
        },
      ],
    },
    {
      title: 'גישה ניתוחית וקיבוע',
      blocks: [
        {
          fields: [
            f('operative_side', 'צד מנותח', SIDE),
            f('approach', 'גישה ניתוחית', list('אחורית', 'קדמית (DAA)', 'אנטרו-לטרלית', 'לטרלית (Hardinge)')),
            f('hip_fixation', 'קיבוע', list('Cementless', 'Cemented', 'Hybrid')),
          ],
        },
      ],
    },
  ],
}

export const PREOP_SCHEMAS: PreopSchema[] = [tka, tha, pka]

export function schemaFor(key: string | null | undefined): PreopSchema | null {
  return PREOP_SCHEMAS.find((s) => s.id === key) ?? null
}

export const allFields = (s: PreopSchema): FormField[] =>
  s.groups.flatMap((g) => [
    ...g.blocks.flatMap((b) => b.fields),
    ...(g.planeTable?.rows.flatMap((r) => r.cells.flat()) ?? []),
  ])

/** label shown for a stored value (falls back to the raw value for legacy data) */
export function optionLabel(field: FormField, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const v = String(value)
  return field.options.find((o) => o.value === v)?.label ?? v
}
