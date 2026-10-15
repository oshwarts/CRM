import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'

/** a link to the settings page, which only managers can open; for everyone else the same words, without the link */
export function SettingsLink({ className, children }: { className?: string; children: ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? (
    <Link to="/settings" className={className}>
      {children}
    </Link>
  ) : (
    <span className="font-medium">{children} (למנהל)</span>
  )
}
