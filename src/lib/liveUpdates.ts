// Live updates: when somebody else changes a record, the screens that show it refresh by themselves.
// The server tells the app which table changed (Supabase Realtime, with the same rules of access as everything else); the app then
// reloads only the lists of that table, at most once every couple of seconds, and only while the screen is open and nothing waits
// in the offline outbox. Nothing is sent when nobody changes anything.
import { useEffect } from 'react'
import { supabase } from './supabase'
import { queryClient } from './queryClient'
import { outboxSize } from './outbox'

const KEYS: Record<string, string[]> = {
  doctors: ['doctors', 'doctor', 'pipeline-doctors', 'doctor-activity', 'map-data'],
  doctor_stage_history: ['stage-since', 'stage-history-all', 'stage-history'],
  meetings: ['meetings', 'meeting', 'doctor-meetings', 'doctor-activity'],
  meeting_tasks: ['tasks'],
  task_subtasks: ['tasks'],
  patient_scans: ['patient-scans', 'done-scan-counts'],
  hospitals: ['map-data', 'hospitals'],
  hospital_agents: ['map-data', 'hospital-agents'],
  planned_surgeries: ['planned-surgeries'],
  competitor_intel: ['competitor-intel'],
  projects: ['projects'],
  project_updates: ['project-updates', 'projects'],
  consumable_counts: ['consumable-counts', 'all-counts'],
  upload_requests: ['upload-requests'],
}

const DELAY_MS = 2000
/** a channel name of its own for every subscription: re-subscribing under the same name (strict mode, hot reload) fails with "cannot add callbacks after subscribe()" */
let channelCounter = 0

export function useLiveUpdates(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const pending = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined

    const flush = () => {
      timer = undefined
      if (pending.size === 0) return
      // an unsent change of this device goes first: a reload now would put the old values back on the screen
      if (document.visibilityState !== 'visible' || outboxSize() > 0) return schedule()
      for (const key of pending) void queryClient.invalidateQueries({ queryKey: [key] })
      pending.clear()
    }
    const schedule = () => {
      if (!timer) timer = setTimeout(flush, DELAY_MS)
    }

    const channel = supabase
      .channel(`live-updates-${++channelCounter}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        for (const key of KEYS[payload.table] ?? []) pending.add(key)
        schedule()
      })
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && pending.size > 0 && schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [enabled])
}
