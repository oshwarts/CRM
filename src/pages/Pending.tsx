import { Clock } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'

/** shown to a signed-in user whose account is not approved yet (or was deactivated) */
export default function Pending() {
  const { profile, signOut, refreshProfile } = useAuth()
  const deactivated = !!profile?.status_changed_at

  return (
    <div className="grid min-h-full place-items-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm space-y-4 p-7 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-600">
          <Clock size={22} />
        </div>
        <h1 className="text-xl font-semibold text-brand-800">
          {deactivated ? 'החשבון הושבת' : 'ממתין לאישור מנהל'}
        </h1>
        <p className="text-sm text-slate-500">
          {deactivated
            ? 'הגישה שלך למערכת הושבתה. לפרטים פנה למנהל המערכת.'
            : 'נרשמת בהצלחה. הגישה לנתונים תיפתח לאחר שמנהל המערכת יאשר את המשתמש שלך.'}
        </p>
        <p dir="ltr" className="text-xs text-slate-400">
          {profile?.email}
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => refreshProfile()}>
            בדוק שוב
          </button>
          <button className="btn-ghost flex-1" onClick={() => signOut()}>
            התנתק
          </button>
        </div>
      </div>
    </div>
  )
}
