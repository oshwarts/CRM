// Schematic bone views in the MAKO Case-Planning style: pale bone silhouette on a
// dark ground with light-blue landmark dots. Not anatomically exact — enough for
// at-a-glance recognition of which plane / bone each cell shows.

type Props = { className?: string }

const bone = '#cfd4da'
const boneDark = '#a7adb6'
const dot = '#3ea0ff'
const implant = '#6b7280'

function Dots({ points }: { points: [number, number][] }) {
  return (
    <>
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={7} fill="#0b3a66" />
          <circle cx={x} cy={y} r={5.5} fill={dot} />
          <text
            x={x}
            y={y + 3}
            textAnchor="middle"
            fontSize="7"
            fill="#fff"
            fontWeight="700"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </>
  )
}

const box = 'viewBox' as const

export function MakoBoneSVG({ name, className }: { name: string; className?: string } & Props) {
  const common = {
    className,
    xmlns: 'http://www.w3.org/2000/svg',
    width: '100%',
    height: '100%',
    preserveAspectRatio: 'xMidYMid meet',
  }

  switch (name) {
    /* ---------- FEMUR ---------- */
    case 'femur-coronal':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path
            d="M70 0 h60 v55 q22 4 26 30 q3 22 -10 40 q-14 18 -46 18 q-32 0 -46 -18 q-13 -18 -10 -40 q4 -26 26 -30 z"
            fill={bone}
            stroke={boneDark}
          />
          <path d="M100 88 v50" stroke={boneDark} strokeDasharray="4 4" />
          <rect x="44" y="118" width="112" height="12" rx="2" fill={implant} opacity="0.5" />
          <Dots points={[[52, 108], [70, 116], [100, 120], [130, 116], [148, 108]]} />
        </svg>
      )
    case 'femur-axial':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path
            d="M40 40 q60 -30 120 0 q14 8 12 34 q-3 30 -30 44 q-16 10 -42 10 q-26 0 -42 -10 q-27 -14 -30 -44 q-2 -26 12 -34 z"
            fill={bone}
            stroke={boneDark}
          />
          <path d="M92 40 q8 26 0 60 M108 40 q-8 26 0 60" stroke={boneDark} fill="none" />
          <Dots points={[[60, 58], [82, 74], [100, 70], [118, 74], [140, 58]]} />
        </svg>
      )
    case 'femur-sagittal':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path
            d="M60 0 h40 v46 q40 2 46 40 q4 30 -22 50 q-20 14 -50 8 q-26 -6 -30 -34 q-3 -22 10 -40 q10 -14 26 -18 z"
            fill={bone}
            stroke={boneDark}
          />
          <path d="M56 96 q34 30 74 6" stroke={implant} strokeWidth="6" fill="none" opacity="0.55" />
          <Dots points={[[70, 60], [96, 96], [108, 118], [118, 96]]} />
        </svg>
      )

    /* ---------- TIBIA ---------- */
    case 'tibia-coronal':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path
            d="M52 8 q48 -14 96 0 q6 22 2 34 h-100 q-4 -12 2 -34 z"
            fill={bone}
            stroke={boneDark}
          />
          <path d="M74 42 q26 70 22 100 h8 q-4 -30 22 -100 z" fill={bone} stroke={boneDark} />
          <rect x="46" y="34" width="108" height="12" rx="2" fill={implant} opacity="0.5" />
          <Dots points={[[62, 30], [88, 30], [100, 28], [112, 30], [138, 30]]} />
        </svg>
      )
    case 'tibia-axial':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path
            d="M46 54 q22 -34 54 -34 q32 0 54 34 q10 18 2 40 q-10 26 -56 26 q-46 0 -56 -26 q-8 -22 2 -40 z"
            fill={bone}
            stroke={boneDark}
          />
          <path d="M100 22 v18 M96 40 q4 8 8 0" stroke={boneDark} fill="none" />
          <Dots points={[[64, 58], [86, 76], [100, 66], [114, 76], [136, 58]]} />
        </svg>
      )
    case 'tibia-sagittal':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path
            d="M40 24 q60 -22 120 6 l-4 30 q-56 16 -112 2 z"
            fill={bone}
            stroke={boneDark}
          />
          <path d="M78 62 q22 60 18 84 h10 q-6 -34 18 -78 z" fill={bone} stroke={boneDark} />
          <path d="M40 30 l120 8" stroke={implant} strokeWidth="6" opacity="0.55" />
          <Dots points={[[58, 40], [86, 52], [100, 46], [116, 52], [142, 40]]} />
        </svg>
      )

    /* ---------- HIP ---------- */
    case 'pelvis-coronal':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path
            d="M30 20 q40 -14 70 6 q30 -20 70 -6 q10 40 -14 66 q-24 24 -56 24 q-32 0 -56 -24 q-24 -26 -14 -66 z"
            fill={bone}
            stroke={boneDark}
          />
          <circle cx="100" cy="78" r="30" fill="#11151c" stroke={implant} strokeWidth="6" />
          <circle cx="100" cy="78" r="18" fill={bone} />
          <Dots points={[[74, 66], [100, 50], [126, 66], [100, 106]]} />
        </svg>
      )
    case 'pelvis-axial':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path d="M24 74 q76 -60 152 0 q-76 46 -152 0 z" fill={bone} stroke={boneDark} />
          <ellipse cx="100" cy="70" rx="34" ry="16" fill="#11151c" stroke={implant} strokeWidth="6" />
          <path d="M100 70 l30 -14" stroke={dot} strokeWidth="3" />
          <Dots points={[[70, 66], [100, 58], [130, 66]]} />
        </svg>
      )
    case 'hip-center':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <circle cx="100" cy="75" r="40" fill="none" stroke={boneDark} strokeDasharray="4 5" />
          <circle cx="100" cy="75" r="26" fill={bone} stroke={boneDark} />
          <path d="M60 75 h80 M100 35 v80" stroke={dot} strokeWidth="2" />
          <Dots points={[[100, 75]]} />
        </svg>
      )
    case 'femur-ap-stem':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path d="M96 8 h20 l14 130 h-30 z" fill={bone} stroke={boneDark} />
          <circle cx="78" cy="34" r="20" fill={bone} stroke={boneDark} />
          <path d="M96 24 q-22 -4 -26 20" fill="none" stroke={boneDark} />
          <path d="M100 40 l6 90 h10 l-4 -84 z" fill={implant} opacity="0.7" />
          <circle cx="72" cy="30" r="12" fill={implant} opacity="0.7" />
          <Dots points={[[72, 30], [100, 46], [110, 110]]} />
        </svg>
      )
    case 'femur-length':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <path d="M92 6 h26 l10 134 h-40 z" fill={bone} stroke={boneDark} />
          <circle cx="74" cy="30" r="18" fill={bone} stroke={boneDark} />
          <path d="M40 30 h120" stroke={dot} strokeDasharray="5 4" />
          <path d="M40 120 h120" stroke={dot} strokeDasharray="5 4" />
          <path d="M46 30 v90" stroke={dot} strokeWidth="2" />
          <Dots points={[[74, 30], [110, 120]]} />
        </svg>
      )
    case 'hip-combined':
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <ellipse cx="100" cy="60" rx="40" ry="18" fill="none" stroke={implant} strokeWidth="5" />
          <path d="M100 60 l34 -12" stroke={dot} strokeWidth="3" />
          <path d="M100 60 l24 18" stroke="#f59e0b" strokeWidth="3" />
          <path d="M100 60 v70" stroke={boneDark} />
          <Dots points={[[100, 60]]} />
        </svg>
      )

    default:
      return (
        <svg {...common} {...{ [box]: '0 0 200 150' }}>
          <rect x="60" y="30" width="80" height="90" rx="8" fill={bone} stroke={boneDark} />
        </svg>
      )
  }
}
