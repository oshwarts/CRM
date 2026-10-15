import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useProcedures } from '../lib/api'
import { useTrainingStages } from '../lib/agentsApi'
import {
  useDeleteTrack,
  useDeleteTrackItem,
  useLearnTopics,
  useSaveTrack,
  useSaveTrackItem,
  useSwapTrackItems,
  useTracks,
  type TrackWithItems,
} from '../lib/learnApi'
import { ConfirmButton, Modal } from './ui'

const AUDIENCE: Record<string, string> = { new: 'סוכן חדש', veteran: 'סוכן ותיק', all: 'כולם' }

function TrackEditor({ track }: { track: TrackWithItems }) {
  const topics = useLearnTopics()
  const stages = useTrainingStages()
  const procedures = useProcedures()
  const saveTrack = useSaveTrack()
  const delTrack = useDeleteTrack()
  const saveItem = useSaveTrackItem()
  const delItem = useDeleteTrackItem()
  const swap = useSwapTrackItems()
  const [title, setTitle] = useState(track.title)
  const [addTopic, setAddTopic] = useState('')

  const used = new Set(track.items.map((i) => i.topic_id))
  const stageLabel = (id: string) => {
    const s = (stages.data ?? []).find((x) => x.id === id)
    if (!s) return ''
    const proc = (procedures.data ?? []).find((p) => p.id === s.procedure_id)?.name
    return proc ? `${s.name} (${proc})` : s.name
  }
  // only a stage that needs a single completion can be completed by passing a quiz
  const linkable = (stages.data ?? []).filter((s) => s.required_count === 1)

  return (
    <section className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input className="input !w-56 !py-1 text-sm" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title.trim() !== track.title && saveTrack.mutate({ id: track.id, title, description: track.description, audience: track.audience })} aria-label="שם המסלול" />
        <select className="input !w-auto !py-1 text-sm" value={track.audience} onChange={(e) => saveTrack.mutate({ id: track.id, title: track.title, description: track.description, audience: e.target.value })} aria-label="קהל יעד">
          {Object.entries(AUDIENCE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <ConfirmButton className="btn-ghost !px-1.5 text-red-500" message={`למחוק את המסלול "${track.title}"? הנושאים עצמם לא יימחקו.`} onConfirm={() => delTrack.mutate(track.id)}>
          <Trash2 size={14} />
        </ConfirmButton>
      </div>
      <ol className="space-y-2">
        {track.items.map((it, i) => {
          const topic = (topics.data ?? []).find((t) => t.id === it.topic_id)
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs text-slate-500">{i + 1}</span>
              <span className="min-w-28 flex-1 font-medium text-slate-700">{topic?.title ?? '—'}</span>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                ציון עובר
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input !w-16 !py-1 text-sm"
                  defaultValue={it.pass_pct}
                  onBlur={(e) => Number(e.target.value) !== it.pass_pct && saveItem.mutate({ id: it.id, track_id: it.track_id, topic_id: it.topic_id, sort: it.sort, pass_pct: Number(e.target.value), stage_id: it.stage_id })}
                />
                %
              </label>
              <select
                className="input !w-auto max-w-48 !py-1 text-xs"
                value={it.stage_id ?? ''}
                onChange={(e) => saveItem.mutate({ id: it.id, track_id: it.track_id, topic_id: it.topic_id, sort: it.sort, pass_pct: it.pass_pct, stage_id: e.target.value || null })}
                aria-label="שלב הכשרה שנסגר אוטומטית"
                title="שלב בהכשרה שייסגר אוטומטית כשהסוכן עובר את המבחן"
              >
                <option value="">ללא קישור להכשרה</option>
                {linkable.map((s) => (
                  <option key={s.id} value={s.id}>
                    סוגר: {stageLabel(s.id)}
                  </option>
                ))}
              </select>
              <button className="btn-ghost !px-1.5" disabled={i === 0} onClick={() => swap.mutate({ a: it, b: track.items[i - 1] })} aria-label="למעלה">
                <ArrowUp size={14} />
              </button>
              <button className="btn-ghost !px-1.5" disabled={i === track.items.length - 1} onClick={() => swap.mutate({ a: it, b: track.items[i + 1] })} aria-label="למטה">
                <ArrowDown size={14} />
              </button>
              <ConfirmButton className="btn-ghost !px-1.5 text-red-500" message="להסיר את הנושא מהמסלול?" onConfirm={() => delItem.mutate(it.id)}>
                <Trash2 size={14} />
              </ConfirmButton>
            </li>
          )
        })}
      </ol>
      <div className="mt-2 flex gap-2">
        <select className="input !w-56 !py-1 text-sm" value={addTopic} onChange={(e) => setAddTopic(e.target.value)} aria-label="נושא להוספה">
          <option value="">הוסף נושא למסלול…</option>
          {(topics.data ?? []).filter((t) => !used.has(t.id)).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary !py-1 text-xs"
          disabled={!addTopic || saveItem.isPending}
          onClick={() => saveItem.mutate({ track_id: track.id, topic_id: addTopic, sort: (track.items[track.items.length - 1]?.sort ?? -1) + 1, pass_pct: 80, stage_id: null }, { onSuccess: () => setAddTopic('') })}
        >
          <Plus size={13} /> הוסף
        </button>
      </div>
    </section>
  )
}

/** managers: tracks (ordered paths of topics), the pass mark of each step, and the training stage it completes */
export function TrackManager({ onClose }: { onClose: () => void }) {
  const tracks = useTracks()
  const save = useSaveTrack()
  const [title, setTitle] = useState('')
  return (
    <Modal open onClose={onClose} title="ניהול מסלולי למידה" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          מסלול הוא רצף נושאים לפי סדר. נושא נפתח בסדר המסלול אחרי שהסוכן עובר את המבחן של הקודם בציון העובר. אפשר לקשר צעד לשלב בהכשרה (למשל JR101), והוא יסומן כהושלם אוטומטית כשהסוכן עובר.
        </p>
        {(tracks.data ?? []).map((t) => (
          <TrackEditor key={t.id} track={t} />
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            save.mutate({ title, description: '', audience: 'all', sort: (tracks.data ?? []).length }, { onSuccess: () => setTitle('') })
          }}
        >
          <input className="input !w-56 !py-1 text-sm" dir="auto" placeholder="מסלול חדש…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn-secondary !py-1 text-xs" disabled={!title.trim() || save.isPending}>
            <Plus size={13} /> מסלול
          </button>
        </form>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </Modal>
  )
}
