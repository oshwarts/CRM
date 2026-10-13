import { useRef, useState } from 'react'
import { FileText, Paperclip, Trash2, X } from 'lucide-react'
import { openProjectFile, useAddProjectUpdate, useDeleteProjectUpdate, useProjectFiles, useProjectUpdates } from '../lib/projectsApi'
import { useAuth } from '../context/AuthProvider'
import { ConfirmButton, Spinner } from './ui'

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)

/** the project's log: short updates (a call, a mail, an approval) with files attached; optionally limited to one task */
export function ProjectUpdates({ projectId, taskId, taskNames }: { projectId: string; taskId?: string; taskNames?: Map<string, string> }) {
  const { profile, isAdmin, user } = useAuth()
  const updates = useProjectUpdates(projectId)
  const files = useProjectFiles(projectId)
  const add = useAddProjectUpdate()
  const del = useDeleteProjectUpdate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState('')
  const [picked, setPicked] = useState<File[]>([])
  const [error, setError] = useState('')

  const list = (updates.data ?? []).filter((u) => !taskId || u.task_id === taskId)

  async function post() {
    setError('')
    if (!body.trim() && picked.length === 0) return
    try {
      await add.mutateAsync({
        projectId,
        taskId: taskId ?? null,
        body,
        files: picked,
        authorName: profile?.full_name || profile?.email || '',
      })
      setBody('')
      setPicked([])
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-slate-200 p-3">
        <textarea className="input min-h-16" dir="auto" placeholder="מה קרה? שיחה, מייל, אישור, חסם…" value={body} onChange={(e) => setBody(e.target.value)} />
        {picked.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {picked.map((f, i) => (
              <li key={i} className="chip border-slate-200 bg-slate-50 text-slate-600">
                <FileText size={12} /> {f.name}
                <button type="button" onClick={() => setPicked((x) => x.filter((_, k) => k !== i))} aria-label="הסר">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            <Paperclip size={16} />
            צרף קובץ או תמונה
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              setPicked((x) => [...x, ...Array.from(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <button className="btn-primary" onClick={post} disabled={add.isPending || (!body.trim() && picked.length === 0)}>
            {add.isPending ? 'שומר…' : 'הוסף עדכון'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {updates.isLoading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">עדיין אין עדכונים.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((u) => {
            const attached = (files.data ?? []).filter((f) => f.update_id === u.id)
            return (
              <li key={u.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    {u.author_name || 'משתמש'} · {fmt(u.created_at)}
                    {!taskId && u.task_id && taskNames?.get(u.task_id) && <span className="mr-2 text-slate-500">· משימה: {taskNames.get(u.task_id)}</span>}
                  </p>
                  {(isAdmin || u.author_id === user?.id) && (
                    <ConfirmButton className="btn-ghost !px-1.5 text-slate-300 hover:text-red-500" message="למחוק את העדכון והקבצים שצורפו אליו?" onConfirm={() => del.mutate(u.id)}>
                      <Trash2 size={14} />
                    </ConfirmButton>
                  )}
                </div>
                {u.body && (
                  <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {u.body}
                  </p>
                )}
                {attached.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {attached.map((f) => (
                      <li key={f.id}>
                        <button
                          className="chip border-brand-200 bg-brand-50 text-brand-700 hover:underline"
                          onClick={async () => {
                            const err = await openProjectFile(f)
                            if (err) setError(err)
                          }}
                        >
                          <FileText size={12} /> {f.file_name} <span className="text-slate-400">{kb(f.file_size)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
