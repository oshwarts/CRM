import { useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { classNames } from '../lib/utils'
import { newVersionAvailable, useOnline } from '../lib/offline'

/** pulls the latest data from the server (what other agents added or changed) and loads a new app version if there is one */
export function RefreshButton({ label = false }: { label?: boolean }) {
  const qc = useQueryClient()
  const fetching = useIsFetching()
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [doneAt, setDoneAt] = useState<Date | null>(null)

  async function refresh() {
    if (busy || !online) return
    setBusy(true)
    try {
      if (await newVersionAvailable()) {
        window.location.reload()
        return
      }
      await qc.invalidateQueries()
      setDoneAt(new Date())
    } finally {
      setBusy(false)
    }
  }

  const spinning = busy || fetching > 0
  const time = doneAt?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

  return (
    <button
      className={classNames('btn-ghost', label ? 'w-full justify-start' : '!px-2')}
      onClick={refresh}
      aria-label="רענון נתונים"
      disabled={!online}
      title={!online ? 'אין חיבור לרשת' : time ? `עודכן ב-${time}` : 'רענון נתונים'}
    >
      <RefreshCw size={label ? 16 : 20} className={spinning ? 'animate-spin' : ''} />
      {label && (
        <span className="flex flex-col items-start leading-tight">
          רענון נתונים
          {time && <span className="text-[11px] font-normal text-slate-400">עודכן ב-{time}</span>}
        </span>
      )}
    </button>
  )
}
