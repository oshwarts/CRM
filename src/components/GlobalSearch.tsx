import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, CalendarDays, CheckSquare, FolderKanban, GraduationCap, Search, Stethoscope, Users, X } from 'lucide-react'
import { useContacts, useDoctors, useHospitals, useMeetings, useTasks } from '../lib/api'
import { useProjects } from '../lib/projectsApi'
import { useLearnTopics } from '../lib/learnApi'
import { normalizeHe } from '../lib/contactMatch'
import { useAuth } from '../context/AuthProvider'
import { formatDate } from '../lib/utils'
import { useDialog } from './ui'

type Hit = { key: string; group: string; title: string; sub: string; to: string; icon: React.ReactNode }

const PER_GROUP = 5

/** one search box for everything: doctors, hospitals, contacts, meetings, tasks, projects and learning topics */
export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const contacts = useContacts()
  const meetings = useMeetings()
  const tasks = useTasks()
  const projects = useProjects()
  const topics = useLearnTopics()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()
  useDialog(true, onClose, box)
  useEffect(() => input.current?.focus(), [])

  const { hits, more } = useMemo(() => {
    const words = normalizeHe(q).split(' ').filter(Boolean)
    if (words.length === 0) return { hits: [] as Hit[], more: 0 }
    const match = (...parts: (string | null | undefined)[]) => {
      const hay = normalizeHe(parts.filter(Boolean).join(' '))
      return words.every((w) => hay.includes(w))
    }
    const out: Hit[] = []
    let hidden = 0
    const add = (group: string, list: Hit[]) => {
      hidden += Math.max(0, list.length - PER_GROUP)
      out.push(...list.slice(0, PER_GROUP).map((h) => ({ ...h, group })))
    }
    add(
      'רופאים',
      (doctors.data ?? [])
        .filter((d) => match(d.title, d.name, d.position, d.phone, d.email))
        .map((d) => ({ key: `d${d.id}`, group: '', title: `${d.title} ${d.name}`.trim(), sub: d.position || d.doctor_hospitals.map((h) => h.hospital?.name).filter(Boolean).join(', '), to: `/doctors/${d.id}`, icon: <Stethoscope size={16} /> })),
    )
    add(
      'בתי חולים',
      (hospitals.data ?? []).filter((h) => match(h.name)).map((h) => ({ key: `h${h.id}`, group: '', title: h.name, sub: h.city || 'בית חולים', to: `/hospitals/${h.id}`, icon: <Building2 size={16} /> })),
    )
    add(
      'אנשי קשר',
      (contacts.data ?? [])
        // a contact that belongs to no doctor and no hospital is opened in the settings, which only managers may open
        .filter((c) => (c.doctor_id || c.hospital_id || isAdmin) && match(c.name, c.role, c.phone, c.office_phone, c.email))
        .map((c) => ({ key: `c${c.id}`, group: '', title: c.name, sub: [c.role, c.phone].filter(Boolean).join(' · '), to: c.doctor_id ? `/doctors/${c.doctor_id}` : c.hospital_id ? `/hospitals/${c.hospital_id}` : '/settings', icon: <Users size={16} /> })),
    )
    add(
      'פגישות',
      (meetings.data ?? [])
        .filter((m) => match(m.subject, m.summary, m.location, ...m.meeting_doctors.map((x) => x.doctor?.name)))
        .map((m) => ({ key: `m${m.id}`, group: '', title: m.subject || 'פגישה', sub: [formatDate(m.meeting_date), m.hospital?.name].filter(Boolean).join(' · '), to: `/meetings/${m.id}`, icon: <CalendarDays size={16} /> })),
    )
    add(
      'משימות',
      (tasks.data ?? [])
        .filter((t) => match(t.description, t.notes, t.doctor?.name, t.coordinator?.name, t.coordinator_text))
        .map((t) => ({ key: `t${t.id}`, group: '', title: t.description, sub: [t.is_done ? 'בוצעה' : t.due_date ? `יעד ${formatDate(t.due_date)}` : 'פתוחה', t.doctor?.name].filter(Boolean).join(' · '), to: '/tasks', icon: <CheckSquare size={16} /> })),
    )
    add(
      'פרויקטים',
      (projects.data ?? []).filter((p) => match(p.name, p.description)).map((p) => ({ key: `p${p.id}`, group: '', title: p.name, sub: 'פרויקט', to: `/projects/${p.id}`, icon: <FolderKanban size={16} /> })),
    )
    add(
      'לומדה',
      (topics.data ?? []).filter((t) => match(t.title, t.description)).map((t) => ({ key: `l${t.id}`, group: '', title: t.title, sub: `${t.cards} שאלות`, to: `/learn/${t.id}`, icon: <GraduationCap size={16} /> })),
    )
    return { hits: out, more: hidden }
  }, [q, isAdmin, doctors.data, hospitals.data, contacts.data, meetings.data, tasks.data, projects.data, topics.data])

  useEffect(() => setActive(0), [q])
  // the highlighted result stays in view while the arrow keys move it
  useEffect(() => {
    box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function go(h: Hit) {
    onClose()
    navigate(h.to)
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-slate-900/50 p-3 pt-[calc(env(safe-area-inset-top)+3rem)] backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="חיפוש">
      <div ref={box} tabIndex={-1} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={input}
            className="min-w-0 flex-1 bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="חפש רופא, בית חולים, איש קשר, פגישה, משימה…"
            value={q}
            dir="auto"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="חיפוש"
            enterKeyHint="search"
            autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, hits.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && hits[active]) go(hits[active])
            }}
          />
          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="סגור">
            <X size={18} />
          </button>
        </div>
        <div id={listId} role="listbox" aria-label="תוצאות חיפוש" className="max-h-[65vh] overflow-y-auto p-2">
          {q.trim() === '' ? (
            <p className="p-6 text-center text-sm text-slate-500">התחל להקליד כדי לחפש בכל המערכת. אפשר גם בקיצור Ctrl+K.</p>
          ) : hits.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">לא נמצאו תוצאות עבור "{q}"</p>
          ) : (
            hits.map((h, i) => (
              <div key={h.key} role="presentation">
                {(i === 0 || hits[i - 1].group !== h.group) && <p role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold text-brand-700">{h.group}</p>}
                <button
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-right transition ${i === active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className="block truncate text-sm font-medium text-slate-800">
                      {h.title}
                    </span>
                    {h.sub && (
                      <span dir="auto" className="block truncate text-xs text-slate-500">
                        {h.sub}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            ))
          )}
          {more > 0 && <p className="px-3 pb-1 pt-2 text-center text-xs text-slate-500">ועוד {more} תוצאות — הוסף מילה כדי לדייק</p>}
        </div>
      </div>
    </div>
  )
}
