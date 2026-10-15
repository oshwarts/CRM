import { useId } from 'react'
import { classNames } from '../lib/utils'

/**
 * The company logo (striped circle, "AMI", "technologies"), drawn as SVG so that it stays sharp at every size and
 * its colours follow the light / dark theme. `light` = white version for the navy backgrounds (login, banners).
 * This is a redraw from the logo image; to use the original artwork exactly, replace the SVG below with the file.
 */
export function BrandLogo({ size = 'md', light, className }: { size?: 'sm' | 'md' | 'lg'; light?: boolean; className?: string }) {
  const clip = useId()
  const h = size === 'lg' ? 'h-14' : size === 'md' ? 'h-9' : 'h-7'
  const ink = light ? 'fill-white' : 'fill-[#00326d] dark:fill-white'
  const blue = light ? 'fill-white' : 'fill-[#1863dc] dark:fill-[#4d8be6]'
  const gap = light ? 'fill-[#00326d]' : 'fill-white dark:fill-[#101e33]'
  return (
    <svg viewBox="0 0 156 56" role="img" aria-label="AMI Technologies" style={{ direction: 'ltr' }} className={classNames(h, 'w-auto shrink-0', className)}>
      <defs>
        <clipPath id={clip}>
          <circle cx="28" cy="28" r="27" />
        </clipPath>
      </defs>
      <circle cx="28" cy="28" r="27" className={blue} />
      <g clipPath={`url(#${clip})`} className={gap}>
        <rect x="0" y="9" width="56" height="2.6" />
        <rect x="0" y="18" width="56" height="2.6" />
        <rect x="0" y="27" width="56" height="2.6" />
        <rect x="0" y="36" width="56" height="2.6" />
        <rect x="0" y="45" width="56" height="2.6" />
      </g>
      <text x="64" y="34" fontFamily="'Arial Black', 'Segoe UI', Arial, sans-serif" fontWeight="900" fontSize="34" letterSpacing="-1" className={ink}>
        AMI
      </text>
      <text x="65" y="50" fontFamily="'Segoe UI', Arial, sans-serif" fontWeight="600" fontSize="14.5" className={blue}>
        technologies
      </text>
    </svg>
  )
}
