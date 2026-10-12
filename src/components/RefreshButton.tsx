import { useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { classNames } from '../lib/utils'

/** is a newer build of the app deployed? (compares the script hash in index.html with the running one) */
async function newVersionAvailable(): Promise<boolean> {
  try {
    const running = [...document.scripts].map((s) => s.src.match(/assets\/(index-[\w-]+\.js)/)?.[1]).find(Boolean)
    if (!running) return false
    const html = await (await fetch('/index.html', { cache: 'no-store' })).text()
    const latest = html.match(/assets\/(index-[\w-]+\.js)/)?.[1]
    return !!latest && latest !== running
  } catch {
    return false
  }
}

/** pulls the latest data from the server (what other agents added or changed) and loads a new app version if there is one */
export function RefreshButton({ label = false }: { label?: boolean }) {
  const qc = useQueryClient()
  const fetching = useIsFetching()
  const [busy, setBusy] = useState(false)
  const [doneAt, setDoneAt] = useState<Date | null>(null)

  async function refresh() {
    if (busy) return
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
      title={time ? `עודכן ב-${time}` : 'רענון נתונים'}
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
