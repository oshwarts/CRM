// A small biomechanical model of MAKO total-knee planning, so the screen behaves
// anatomically: rotating a component changes the medial / lateral resections and
// the gaps; cutting deeper opens the gap; femoral valgus offsets the limb axis.
// Values are approximate — enough that the numbers move in the right direction.

export type KneeInputs = {
  side: 'left' | 'right'
  // femur
  fem_coronal: number // component coronal alignment vs mechanical axis; + = valgus
  fem_rotation: number // vs TEA; + = external, − = internal
  fem_flexion: number // + = flexion
  fem_distal: number // nominal distal resection (mm, at the reference condyle)
  fem_posterior: number // nominal posterior resection (mm)
  fem_size: number
  // tibia
  tib_coronal: number // + = varus
  tib_rotation: number // + = external
  tib_slope: number // posterior slope, + = posterior
  tib_resection: number // nominal (mm, from the higher condyle)
  tib_size: number
  poly: number // insert thickness (mm)
  // per-case anatomy
  aa_ma_offset: number // AA valgus = MA valgus + this
  pca_tea_offset: number // PCA rotation = TEA rotation + this
}

export const KNEE_DEFAULTS: KneeInputs = {
  side: 'left',
  fem_coronal: 3,
  fem_rotation: -3.5,
  fem_flexion: 3.5,
  fem_distal: 6,
  fem_posterior: 6,
  fem_size: 7,
  tib_coronal: 4,
  tib_rotation: 0,
  tib_slope: 4,
  tib_resection: 6.5,
  tib_size: 7,
  poly: 9,
  aa_ma_offset: 6.7,
  pca_tea_offset: 4.5,
}

const K_CORONAL = 0.34 // mm of L↔M spread per degree of coronal tilt
const K_ROT = 0.3 // mm of L↔M posterior spread per degree of rotation
const GAP_BASE = 20 // reference gap (mm) at nominal resections + 9 mm poly

export type KneeDerived = ReturnType<typeof computeKnee>

export function computeKnee(i: KneeInputs) {
  const femValgusMA = i.fem_coronal
  const femValgusAA = i.fem_coronal + i.aa_ma_offset
  const femRotTEA = i.fem_rotation
  const femRotPCA = i.fem_rotation + i.pca_tea_offset

  // distal femoral resection, medial vs lateral (valgus → deeper medially)
  const distalMed = i.fem_distal + i.fem_coronal * K_CORONAL
  const distalLat = i.fem_distal - i.fem_coronal * K_CORONAL

  // posterior femoral resection (external rotation → deeper postero-laterally)
  const postMed = i.fem_posterior - i.fem_rotation * K_ROT
  const postLat = i.fem_posterior + i.fem_rotation * K_ROT

  // tibial resection medial vs lateral (varus → less bone medially)
  const tibMed = i.tib_resection - i.tib_coronal * K_CORONAL
  const tibLat = i.tib_resection + i.tib_coronal * K_CORONAL

  // overall limb alignment: femoral valgus corrects, tibial varus adds
  const limbVarus = i.tib_coronal - i.fem_coronal

  // gaps: cutting more bone opens the gap; thicker poly / bigger femur closes it
  const extGap =
    GAP_BASE +
    (i.fem_distal - 6) +
    (i.tib_resection - 6.5) -
    (i.poly - 9) -
    (i.fem_size - 7) * 0.4
  const flexGap =
    GAP_BASE +
    (i.fem_posterior - 6) +
    (i.tib_resection - 6.5) -
    (i.poly - 9) -
    (i.fem_size - 7) * 0.6
  const gapDiff = flexGap - extGap

  const warnings: string[] = []
  if (Math.abs(gapDiff) > 2)
    warnings.push(
      gapDiff > 0
        ? 'מרווח כיפוף גדול מהזדקפות > 2 מ״מ — לשקול הגדלת Femur / סיבוב חיצוני'
        : 'מרווח הזדקפות גדול מכיפוף > 2 מ״מ — לשקול חיתוך דיסטלי פחות עמוק',
    )
  if (extGap < 17 || flexGap < 17) warnings.push('מרווח הדוק (< 17 מ״מ)')
  if (distalLat < 2 || postLat < 2 || tibLat < 1.5)
    warnings.push('חיתוך רדוד מדי בצד לטרלי (< 2 מ״מ)')
  if (Math.abs(i.fem_size - i.tib_size) >= 2)
    warnings.push('פער גדול בין גודל Femur לגודל Tibia')

  return {
    femValgusMA,
    femValgusAA,
    femRotTEA,
    femRotPCA,
    distalMed,
    distalLat,
    postMed,
    postLat,
    tibMed,
    tibLat,
    limbVarus,
    extGap,
    flexGap,
    gapDiff,
    warnings,
  }
}

/** medial / lateral order for an anterior view, given the operative side */
export function mlOrder(side: 'left' | 'right'): ['M' | 'L', 'M' | 'L'] {
  // left knee, AP view: lateral on the viewer's left, medial on the right
  return side === 'left' ? ['L', 'M'] : ['M', 'L']
}
