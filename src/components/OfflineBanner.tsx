import { useEffect, useRef, useState } from 'react'
import { Cloud, CloudOff } from 'lucide-react'
import { useOnline } from '../lib/offline'

/** tells the user the app is in read-only offline mode, and that data is refreshing after the connection returns */
export function OfflineBanner() {
  const online = useOnline()
  const wasOffline = useRef(false)
  const [back, setBack] = useState(false)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      setBack(false)
      return
    }
    if (wasOffline.current) {
      wasOffline.current = false
      setBack(true)
      const t = setTimeout(() => setBack(false), 4000)
      return () => clearTimeout(t)
    }
  }, [online])

  if (online && !back) return null
  return (
    <div
      role="status"
      className={
        'fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 mx-auto flex max-w-md items-start gap-2 rounded-xl px-3 py-2 text-sm shadow-lg md:bottom-4 ' +
        (online ? 'bg-green-600 text-white' : 'bg-amber-500 text-white')
      }
    >
      {online ? <Cloud size={18} className="mt-0.5 shrink-0" /> : <CloudOff size={18} className="mt-0.5 shrink-0" />}
      <span>
        {online
          ? 'החיבור חזר — הנתונים מתעדכנים.'
          : 'אין חיבור לרשת — מצב קריאה בלבד. מוצגים הנתונים האחרונים שנשמרו; שינויים ושמירה יתאפשרו כשהחיבור יחזור.'}
      </span>
    </div>
  )
}
