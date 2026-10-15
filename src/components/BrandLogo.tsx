import { useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { classNames } from '../lib/utils'

/**
 * The company logo. Put the file in public/ami-logo.png (or .svg: change LOGO_SRC) and it appears everywhere;
 * until the file exists a simple mark with the system name is shown.
 */
const LOGO_SRC = '/ami-logo.png'

export function BrandLogo({ size = 'md', light, className }: { size?: 'sm' | 'md' | 'lg'; light?: boolean; className?: string }) {
  const [missing, setMissing] = useState(false)
  const h = size === 'lg' ? 'h-14' : size === 'md' ? 'h-9' : 'h-7'
  if (!missing)
    return <img src={LOGO_SRC} alt="AMI Technologies" className={classNames(h, 'w-auto object-contain', light && 'brightness-0 invert', className)} onError={() => setMissing(true)} />
  return (
    <div className={classNames('flex items-center gap-2.5', className)}>
      <div className={classNames('grid place-items-center rounded-xl', light ? 'bg-white/15 text-white' : 'bg-brand-800 text-white', size === 'lg' ? 'h-14 w-14' : size === 'md' ? 'h-10 w-10' : 'h-8 w-8')}>
        <Stethoscope size={size === 'lg' ? 26 : 18} />
      </div>
      <div className="leading-tight">
        <p className={classNames('font-semibold', light ? 'text-white' : 'text-brand-800', size === 'lg' ? 'text-2xl' : 'text-sm')}>AMI JR CRM</p>
        {size !== 'sm' && <p className={classNames('text-xs', light ? 'text-white/70' : 'text-slate-500')}>AMI Technologies</p>}
      </div>
    </div>
  )
}
