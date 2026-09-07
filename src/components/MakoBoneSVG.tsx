// Schematic CT-slice views in the MAKO Case-Planning style: magenta bone outline
// + green implant overlay on near-black, with a teal cross-hair. Not real CT —
// enough to recognise the plane and where the implant sits.

const OUTLINE = '#ff3ad0'
const IMPLANT = '#37e23a'
const IMPLANT_D = '#1f9e22'
const FILL = '#1c1c1c'

function Crosshair({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#ffb020" strokeWidth="1.5">
      <line x1={x - 10} y1={y} x2={x + 10} y2={y} />
      <line x1={x} y1={y - 10} x2={x} y2={y + 10} />
      <circle cx={x} cy={y} r="3" fill="none" stroke="#3ee6d6" />
    </g>
  )
}

export function MakoBoneSVG({
  bone,
  view,
  className,
}: {
  bone: 'tibia' | 'femur' | 'pelvis'
  view: 'transverse' | 'coronal' | 'sagittal' | 'model'
  className?: string
}) {
  const svg = {
    className,
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 220 170',
    width: '100%',
    height: '100%',
    preserveAspectRatio: 'xMidYMid meet',
  }
  const key = `${bone}-${view}`

  switch (key) {
    /* ---- TIBIA ---- */
    case 'tibia-transverse':
      return (
        <svg {...svg}>
          <path d="M40 62 q10 -34 70 -34 q60 0 72 34 q8 22 -6 44 q-16 26 -66 26 q-50 0 -66 -26 q-14 -22 -4 -44 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M52 52 q22 -14 46 -8 l4 66 q-30 6 -48 -14 q-10 -20 -2 -44 z" fill={IMPLANT} stroke={IMPLANT_D} />
          <Crosshair x={82} y={82} />
        </svg>
      )
    case 'tibia-coronal':
      return (
        <svg {...svg}>
          <path d="M46 28 q60 -16 128 0 q6 20 2 30 h-132 q-4 -12 2 -30 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M84 58 q22 60 20 92 h12 q-4 -30 22 -92 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M46 30 q40 -8 66 -4 v20 h-64 q-4 -8 -2 -16 z" fill={IMPLANT} stroke={IMPLANT_D} />
          <rect x="70" y="48" width="8" height="20" fill={IMPLANT} stroke={IMPLANT_D} />
          <Crosshair x={80} y={40} />
        </svg>
      )
    case 'tibia-sagittal':
      return (
        <svg {...svg}>
          <path d="M40 34 q70 -22 140 8 l-6 34 q-64 16 -128 0 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M80 74 q20 56 16 84 h12 q-4 -32 20 -76 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M44 40 l128 12 v14 l-126 6 z" fill={IMPLANT} stroke={IMPLANT_D} />
          <path d="M96 66 v22" stroke={IMPLANT_D} strokeWidth="5" />
          <Crosshair x={104} y={54} />
        </svg>
      )

    /* ---- FEMUR ---- */
    case 'femur-transverse':
      return (
        <svg {...svg}>
          <path d="M34 60 q54 -34 96 -30 q28 2 52 22 q14 12 8 40 q-8 34 -40 44 q-20 8 -50 6 q-40 -2 -56 -30 q-14 -26 -10 -52 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M96 40 q10 30 0 62 M116 40 q-10 30 0 62" stroke={OUTLINE} strokeWidth="1.5" fill="none" />
          <path d="M40 66 q24 -22 44 -16 l2 66 q-30 4 -44 -18 q-8 -18 -2 -32 z" fill={IMPLANT} stroke={IMPLANT_D} />
          <Crosshair x={72} y={78} />
        </svg>
      )
    case 'femur-coronal':
      return (
        <svg {...svg}>
          <path d="M52 22 q56 -14 116 0 q10 24 4 44 q-8 26 -30 34 q-16 6 -42 6 q-26 0 -42 -6 q-22 -8 -30 -34 q-6 -20 4 -44 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M100 30 v70 M120 30 v70" stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M52 24 q34 -8 56 -4 q4 40 -6 66 q-14 8 -26 6 q-22 -4 -28 -30 q-6 -20 4 -38 z" fill={IMPLANT} stroke={IMPLANT_D} />
          <Crosshair x={78} y={64} />
        </svg>
      )
    case 'femur-sagittal':
      return (
        <svg {...svg}>
          <path d="M56 20 q60 -8 92 30 q18 24 6 58 q-14 34 -54 40 q-30 4 -50 -18 q-16 -20 -12 -50 q4 -34 12 -60 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M60 30 q56 -4 82 34 q14 22 4 50 q-24 -6 -40 -22 q-30 -30 -46 -62 z" fill={IMPLANT} stroke={IMPLANT_D} opacity="0.92" />
          <path d="M62 96 q30 26 62 8" stroke={IMPLANT_D} strokeWidth="5" fill="none" />
          <Crosshair x={100} y={78} />
        </svg>
      )

    /* ---- PELVIS ---- */
    case 'pelvis-transverse':
      return (
        <svg {...svg}>
          <path d="M24 84 q84 -70 172 0 q-84 52 -172 0 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <ellipse cx="110" cy="78" rx="40" ry="20" fill="none" stroke={IMPLANT} strokeWidth="6" />
          <path d="M110 78 l34 -16" stroke="#3ee6d6" strokeWidth="3" />
          <Crosshair x={110} y={78} />
        </svg>
      )
    case 'pelvis-coronal':
      return (
        <svg {...svg}>
          <path d="M30 26 q46 -16 80 6 q34 -22 80 -6 q12 44 -16 74 q-28 26 -64 26 q-36 0 -64 -26 q-28 -30 -16 -74 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M110 88 m-34 0 a34 34 0 1 1 68 0" fill="none" stroke={IMPLANT} strokeWidth="7" />
          <Crosshair x={110} y={88} />
        </svg>
      )
    case 'pelvis-sagittal':
      return (
        <svg {...svg}>
          <path d="M40 40 q60 -26 120 6 q20 30 4 70 q-20 40 -70 44 q-40 2 -56 -28 q-14 -28 -2 -92 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M100 96 m-30 0 a30 30 0 1 1 60 0" fill="none" stroke={IMPLANT} strokeWidth="7" />
          <path d="M100 96 l26 -12" stroke="#3ee6d6" strokeWidth="3" />
          <Crosshair x={100} y={96} />
        </svg>
      )

    /* ---- 3D MODEL ---- */
    default: {
      // "model" view — white 3D reconstruction with green implant
      if (bone === 'femur')
        return (
          <svg {...svg}>
            <path d="M56 30 q70 -14 104 20 q22 22 10 56 q-12 34 -52 44 q-40 10 -70 -14 q-26 -22 -20 -56 q6 -34 28 -50 z" fill="#e9edf1" stroke="#9aa2ab" />
            <path d="M70 44 q40 -6 60 26 q12 22 2 46 q-24 -4 -40 -20 q-24 -24 -22 -52 z" fill={IMPLANT} stroke={IMPLANT_D} />
          </svg>
        )
      if (bone === 'pelvis')
        return (
          <svg {...svg}>
            <path d="M40 30 q54 -16 90 6 q40 -22 90 -4 q10 50 -20 82 q-30 30 -70 30 q-40 0 -70 -30 q-30 -34 -20 -84 z" fill="#e9edf1" stroke="#9aa2ab" />
            <path d="M110 96 m-32 0 a32 32 0 1 1 64 0" fill="none" stroke={IMPLANT} strokeWidth="10" />
          </svg>
        )
      return (
        <svg {...svg}>
          <path d="M48 40 q64 -20 118 6 q18 26 6 60 q-16 34 -64 42 q-42 6 -64 -20 q-16 -22 -8 -52 q6 -22 16 -36 z" fill="#e9edf1" stroke="#9aa2ab" />
          <path d="M60 50 q30 -10 52 -4 l4 72 q-34 6 -52 -16 q-12 -24 -4 -52 z" fill={IMPLANT} stroke={IMPLANT_D} />
        </svg>
      )
    }
  }
}
