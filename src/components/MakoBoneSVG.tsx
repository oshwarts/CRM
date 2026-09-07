// Schematic CT-slice views in the MAKO Case-Planning style: magenta bone outline
// + green implant overlay on near-black. The implant group can be tilted /
// shifted so it visibly responds to the plan values.

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
  refLines = false,
  implantTilt = 0,
  implantShift = 0,
  mirror = false,
}: {
  bone: 'tibia' | 'femur' | 'pelvis'
  view: 'transverse' | 'axial' | 'coronal' | 'sagittal' | 'model'
  className?: string
  refLines?: boolean
  /** degrees to rotate the implant overlay (varus / rotation / flexion / slope) */
  implantTilt?: number
  /** px to shift the implant along the cut (resection depth) */
  implantShift?: number
  /** flip horizontally (right-knee anterior view) */
  mirror?: boolean
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

  // implant transform, rotated about a plausible joint centre per view
  const centre: Record<string, [number, number]> = {
    'femur-coronal': [110, 55],
    'femur-axial': [110, 70],
    'femur-transverse': [110, 70],
    'femur-sagittal': [104, 70],
    'tibia-coronal': [110, 44],
    'tibia-axial': [100, 82],
    'tibia-transverse': [100, 82],
    'tibia-sagittal': [104, 52],
  }
  const [cx, cy] = centre[key] ?? [110, 85]
  const implantG = `translate(0 ${implantShift}) rotate(${implantTilt} ${cx} ${cy})`
  const rootT = mirror ? 'translate(220 0) scale(-1 1)' : undefined

  const wrap = (bg: React.ReactNode, implant: React.ReactNode, extra?: React.ReactNode) => (
    <svg {...svg}>
      <g transform={rootT}>
        {bg}
        <g transform={implantG}>{implant}</g>
        {extra}
      </g>
    </svg>
  )

  switch (key) {
    /* ---- TIBIA ---- */
    case 'tibia-transverse':
    case 'tibia-axial':
      return wrap(
        <path d="M40 62 q10 -34 70 -34 q60 0 72 34 q8 22 -6 44 q-16 26 -66 26 q-50 0 -66 -26 q-14 -22 -4 -44 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />,
        <path d="M52 52 q22 -14 46 -8 l4 66 q-30 6 -48 -14 q-10 -20 -2 -44 z" fill={IMPLANT} stroke={IMPLANT_D} />,
        <>
          {refLines && <ellipse cx="176" cy="96" rx="12" ry="14" fill={FILL} stroke={OUTLINE} strokeWidth="2" />}
          <Crosshair x={82} y={82} />
        </>,
      )
    case 'tibia-coronal':
      return wrap(
        <>
          <path d="M46 28 q60 -16 128 0 q6 20 2 30 h-132 q-4 -12 2 -30 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M84 58 q22 60 20 92 h12 q-4 -30 22 -92 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
        </>,
        <>
          <path d="M46 30 q64 -10 128 0 v18 h-128 z" fill={IMPLANT} stroke={IMPLANT_D} />
          <rect x="104" y="46" width="8" height="22" fill={IMPLANT} stroke={IMPLANT_D} />
        </>,
        <Crosshair x={110} y={40} />,
      )
    case 'tibia-sagittal':
      return wrap(
        <>
          <path d="M40 34 q70 -22 140 8 l-6 34 q-64 16 -128 0 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M80 74 q20 56 16 84 h12 q-4 -32 20 -76 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
        </>,
        <>
          <path d="M44 40 l128 12 v14 l-126 6 z" fill={IMPLANT} stroke={IMPLANT_D} />
          <path d="M104 66 v22" stroke={IMPLANT_D} strokeWidth="5" />
        </>,
        <Crosshair x={104} y={54} />,
      )

    /* ---- FEMUR ---- */
    case 'femur-transverse':
    case 'femur-axial':
      return wrap(
        <>
          <path d="M34 60 q54 -34 96 -30 q28 2 52 22 q14 12 8 40 q-8 34 -40 44 q-20 8 -50 6 q-40 -2 -56 -30 q-14 -26 -10 -52 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M100 40 q10 30 0 62 M120 40 q-10 30 0 62" stroke={OUTLINE} strokeWidth="1.5" fill="none" />
        </>,
        <path d="M40 66 q80 -22 140 0 l0 30 q-70 20 -140 0 z" fill={IMPLANT} stroke={IMPLANT_D} opacity="0.9" />,
        <>
          {refLines && (
            <>
              <line x1="30" y1="82" x2="196" y2="74" stroke="#4ea0ff" strokeWidth="2.5" />
              <line x1="30" y1="70" x2="196" y2="66" stroke="#ffffff" strokeWidth="1.5" />
            </>
          )}
          <Crosshair x={110} y={78} />
        </>,
      )
    case 'femur-coronal':
      return wrap(
        <>
          <path d="M52 22 q56 -14 116 0 q10 24 4 44 q-8 26 -30 34 q-16 6 -42 6 q-26 0 -42 -6 q-22 -8 -30 -34 q-6 -20 4 -44 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />
          <path d="M100 30 v70 M120 30 v70" stroke={OUTLINE} strokeWidth="1.5" />
        </>,
        <path d="M50 66 q60 -16 120 0 q4 20 -2 34 q-14 8 -34 8 h-14 q-20 0 -34 -8 q-6 -14 -2 -34 z" fill={IMPLANT} stroke={IMPLANT_D} />,
        <>
          {refLines && (
            <>
              <line x1="112" y1="10" x2="104" y2="118" stroke="#4ea0ff" strokeWidth="2" />
              <line x1="116" y1="10" x2="116" y2="118" stroke="#ffffff" strokeWidth="1.5" />
            </>
          )}
          <Crosshair x={110} y={70} />
        </>,
      )
    case 'femur-sagittal':
      return wrap(
        <path d="M56 20 q60 -8 92 30 q18 24 6 58 q-14 34 -54 40 q-30 4 -50 -18 q-16 -20 -12 -50 q4 -34 12 -60 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />,
        <path d="M60 40 q50 -8 78 26 q14 20 8 46 q-6 22 -30 30 q-22 8 -42 -8 q-16 -14 -18 -40 q-2 -30 26 -50 z" fill="none" stroke={IMPLANT} strokeWidth="7" />,
        <Crosshair x={104} y={72} />,
      )

    /* ---- PELVIS ---- */
    case 'pelvis-transverse':
      return wrap(
        <path d="M24 84 q84 -70 172 0 q-84 52 -172 0 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />,
        <>
          <ellipse cx="110" cy="78" rx="40" ry="20" fill="none" stroke={IMPLANT} strokeWidth="6" />
          <path d="M110 78 l34 -16" stroke="#3ee6d6" strokeWidth="3" />
        </>,
        <Crosshair x={110} y={78} />,
      )
    case 'pelvis-coronal':
      return wrap(
        <path d="M30 26 q46 -16 80 6 q34 -22 80 -6 q12 44 -16 74 q-28 26 -64 26 q-36 0 -64 -26 q-28 -30 -16 -74 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />,
        <path d="M110 88 m-34 0 a34 34 0 1 1 68 0" fill="none" stroke={IMPLANT} strokeWidth="7" />,
        <Crosshair x={110} y={88} />,
      )
    case 'pelvis-sagittal':
      return wrap(
        <path d="M40 40 q60 -26 120 6 q20 30 4 70 q-20 40 -70 44 q-40 2 -56 -28 q-14 -28 -2 -92 z" fill={FILL} stroke={OUTLINE} strokeWidth="2" />,
        <>
          <path d="M100 96 m-30 0 a30 30 0 1 1 60 0" fill="none" stroke={IMPLANT} strokeWidth="7" />
          <path d="M100 96 l26 -12" stroke="#3ee6d6" strokeWidth="3" />
        </>,
        <Crosshair x={100} y={96} />,
      )

    /* ---- 3D MODEL ---- */
    default: {
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
