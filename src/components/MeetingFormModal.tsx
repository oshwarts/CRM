import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useAgents,
  useCreateMeeting,
  useDoctors,
  useUpdateMeeting,
  type MeetingFormData,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import {
  MEETING_STATUS_LABELS,
  type MeetingWithRelations,
} from '../lib/types'
import { plusDaysISO } from '../lib/utils'
import {
  Field,
  Modal,
  MultiSelectChips,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from './ui'

type Props = {
  open: boolean
  onClose: () => void
  meeting?: MeetingWithRelations
  defaultDoctorId?: string
}

function initial(
  meeting: MeetingWithRelations | undefined,
  agentId: string | undefined,
  defaultDoctorId: string | undefined,
): MeetingFormData {
  return {
    subject: meeting?.subject ?? '',
    meeting_date: meeting?.meeting_date ?? null,
    meeting_time: meeting?.meeting_time?.slice(0, 5) ?? null,
    location: meeting?.location ?? '',
    responsible_agent_id: meeting?.responsible_agent_id ?? agentId ?? null,
    status: meeting?.status ?? 'scheduled',
    summary: meeting?.summary ?? '',
    decisions: meeting?.decisions ?? '',
    next_followup_date: meeting?.next_followup_date ?? null,
    doctorIds: meeting
      ? meeting.meeting_doctors.map((d) => d.doctor?.id).filter((x): x is string => !!x)
      : defaultDoctorId
        ? [defaultDoctorId]
        : [],
    tasks: meeting
      ? meeting.meeting_tasks.map((t) => ({
          id: t.id,
          description: t.description,
          is_done: t.is_done,
          due_date: t.due_date,
        }))
      : [],
  }
}

export function MeetingFormModal({
  open,
  onClose,
  meeting,
  defaultDoctorId,
}: Props) {
  const isEdit = !!meeting
  const { user } = useAuth()
  const agents = useAgents()
  const doctors = useDoctors()
  const createMeeting = useCreateMeeting()
  const updateMeeting = useUpdateMeeting(meeting?.id ?? '')
  const saving = createMeeting.isPending || updateMeeting.isPending

  const [tab, setTab] = useState('general')
  const [data, setData] = useState<MeetingFormData>(() =>
    initial(meeting, user?.id, defaultDoctorId),
  )
  const [error, setError] = useState<string | null>(null)

  function patch(p: Partial<MeetingFormData>) {
    setData((d) => ({ ...d, ...p }))
  }

  async function submit() {
    setError(null)
    if (!data.subject.trim()) {
      setTab('general')
      setError('יש להזין נושא לפגישה')
      return
    }
    try {
      if (isEdit) await updateMeeting.mutateAsync(data)
      else await createMeeting.mutateAsync(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'עריכת פגישה' : 'הוספת פגישה חדשה'}
      size="xl"
    >
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="general">פרטים כלליים</Tab>
          <Tab id="doctors">רופאים משתתפים</Tab>
          <Tab id="content">תוכן הפגישה</Tab>
        </TabList>

        <TabPanel id="general">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="נושא הפגישה" className="sm:col-span-2">
              <input
                className="input"
                value={data.subject}
                onChange={(e) => patch({ subject: e.target.value })}
                placeholder="הזן נושא הפגישה"
              />
            </Field>
            <Field label="תאריך">
              <input
                type="date"
                className="input"
                value={data.meeting_date ?? ''}
                onChange={(e) => patch({ meeting_date: e.target.value || null })}
              />
            </Field>
            <Field label="שעה">
              <input
                type="time"
                className="input"
                value={data.meeting_time ?? ''}
                onChange={(e) => patch({ meeting_time: e.target.value || null })}
              />
            </Field>
            <Field label="מיקום">
              <input
                className="input"
                value={data.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="מיקום הפגישה"
              />
            </Field>
            <Field label="סוכן אחראי">
              <select
                className="input"
                value={data.responsible_agent_id ?? ''}
                onChange={(e) =>
                  patch({ responsible_agent_id: e.target.value || null })
                }
              >
                <option value="">— ללא —</option>
                {(agents.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="סטטוס">
              <select
                className="input"
                value={data.status}
                onChange={(e) => patch({ status: e.target.value })}
              >
                {Object.entries(MEETING_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="תאריך מעקב הבא" className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="input max-w-48"
                  value={data.next_followup_date ?? ''}
                  onChange={(e) =>
                    patch({ next_followup_date: e.target.value || null })
                  }
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => patch({ next_followup_date: plusDaysISO(14) })}
                >
                  בעוד שבועיים
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => patch({ next_followup_date: plusDaysISO(30) })}
                >
                  בעוד חודש
                </button>
                {data.next_followup_date && (
                  <button
                    type="button"
                    className="btn-ghost text-slate-500"
                    onClick={() => patch({ next_followup_date: null })}
                  >
                    נקה
                  </button>
                )}
              </div>
            </Field>
          </div>
        </TabPanel>

        <TabPanel id="doctors">
          <Field label="רופאים משתתפים">
            <MultiSelectChips
              options={(doctors.data ?? []).map((d) => ({
                id: d.id,
                label: `${d.title} ${d.name}`,
              }))}
              selected={data.doctorIds}
              onToggle={(id) =>
                patch({
                  doctorIds: data.doctorIds.includes(id)
                    ? data.doctorIds.filter((x) => x !== id)
                    : [...data.doctorIds, id],
                })
              }
              labelOf={(o) => o.label}
            />
          </Field>
        </TabPanel>

        <TabPanel id="content">
          <Field label="סיכום הפגישה">
            <textarea
              className="input min-h-28"
              value={data.summary}
              onChange={(e) => patch({ summary: e.target.value })}
            />
          </Field>
          <Field label="החלטות">
            <textarea
              className="input min-h-20"
              value={data.decisions}
              onChange={(e) => patch({ decisions: e.target.value })}
            />
          </Field>
          <Field label="משימות להמשך">
            <div className="space-y-2">
              {data.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={t.is_done}
                    onChange={(e) => {
                      const tasks = [...data.tasks]
                      tasks[i] = { ...t, is_done: e.target.checked }
                      patch({ tasks })
                    }}
                  />
                  <input
                    className="input flex-1"
                    placeholder="תיאור המשימה"
                    value={t.description}
                    onChange={(e) => {
                      const tasks = [...data.tasks]
                      tasks[i] = { ...t, description: e.target.value }
                      patch({ tasks })
                    }}
                  />
                  <input
                    type="date"
                    className="input max-w-40"
                    value={t.due_date ?? ''}
                    onChange={(e) => {
                      const tasks = [...data.tasks]
                      tasks[i] = { ...t, due_date: e.target.value || null }
                      patch({ tasks })
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost !px-2 text-red-500"
                    onClick={() =>
                      patch({ tasks: data.tasks.filter((_, x) => x !== i) })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  patch({
                    tasks: [
                      ...data.tasks,
                      { description: '', is_done: false, due_date: null },
                    ],
                  })
                }
              >
                <Plus size={16} />
                הוסף משימה
              </button>
            </div>
          </Field>
        </TabPanel>
      </Tabs>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button className="btn-secondary" onClick={onClose}>
          ביטול
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'שומר…' : 'שמירה'}
        </button>
      </div>
    </Modal>
  )
}
