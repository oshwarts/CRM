import { useState } from 'react'
import { Clock, UserX } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'

/** shown to a signed-in user whose account is not approved yet (or was deactivated) */
export default function Pending() {
  const { profile, signOut, refreshProfile } = useAuth()
  const deactivated = !!profile?.status_changed_at
  const [checking, setChecking] = useState(false)
  const [stillWaiting, setStillWaiting] = useState(false)

  async function check() {
    setChecking(true)
    setStillWaiting(false)
    try {
      await refreshProfile()
      setStillWaiting(true) // if the account had been approved, this screen is gone by now
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="grid min-h-full place-items-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm space-y-4 p-5 text-center sm:p-7">
        <div className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${deactivated ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
          {deactivated ? <UserX size={22} aria-hidden /> : <Clock size={22} aria-hidden />}
        </div>
        <h1 className="text-xl font-semibold text-brand-800">{deactivated ? 'החשבון הושבת' : 'ממתין לאישור מנהל'}</h1>
        <p className="text-sm text-slate-600">
          {deactivated
            ? 'הגישה שלך למערכת הושבתה. לפרטים פנה למנהל המערכת.'
            : 'נרשמת בהצלחה. הגישה לנתונים תיפתח לאחר שמנהל המערכת יאשר את המשתמש שלך. אפשר לסגור את המסך ולחזור אליו מאוחר יותר.'}
        </p>
        {profile?.email && (
          <p dir="ltr" className="break-all rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
            {profile.email}
          </p>
        )}
        {stillWaiting && !checking && (
          <p role="status" className="text-sm text-amber-700">
            עדיין לא אושר. נסה שוב מאוחר יותר.
          </p>
        )}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => void check()} disabled={checking}>
            {checking ? 'בודק…' : 'בדוק שוב'}
          </button>
          <button className="btn-secondary flex-1" onClick={() => signOut()}>
            התנתק
          </button>
        </div>
      </div>
    </main>
  )
}
