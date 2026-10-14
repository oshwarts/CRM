import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, FileUp, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import {
  useDeleteCard,
  useDeleteTopic,
  useLearnAttempts,
  useLearnCards,
  useLearnProgress,
  useLearnTopics,
  useResetProgress,
  useSaveCard,
  useSaveTopic,
} from '../lib/learnApi'
import type { LearnCard } from '../lib/types'
import { FlashStudy, QuizStudy } from '../components/LearnStudy'
import { LearnImport } from '../components/LearnImport'
import { ConfirmButton, EmptyState, Field, Modal, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { classNames, formatDate } from '../lib/utils'

function CardModal({ topicId, card, onClose }: { topicId: string; card: LearnCard | null; onClose: () => void }) {
  const save = useSaveCard()
  const [q, setQ] = useState(card?.question ?? '')
  const [a, setA] = useState(card?.answer ?? '')
  return (
    <Modal open onClose={onClose} title={card ? 'עריכת שאלה' : 'שאלה חדשה'} size="lg">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ id: card?.id, topic_id: topicId, question: q, answer: a, sort: 999999 }, { onSuccess: onClose })
        }}
      >
        <Field label="שאלה">
          <textarea className="input min-h-20" dir="ltr" required value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label="תשובה">
          <textarea className="input min-h-20" dir="ltr" required value={a} onChange={(e) => setA(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" disabled={!q.trim() || !a.trim() || save.isPending}>
            שמור
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function LearnTopic() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const topics = useLearnTopics()
  const cards = useLearnCards(id)
  const progress = useLearnProgress(user?.id)
  const attempts = useLearnAttempts(user?.id)
  const saveTopic = useSaveTopic()
  const delTopic = useDeleteTopic()
  const delCard = useDeleteCard()
  const reset = useResetProgress()
  const [tab, setTab] = useState('flash')
  const [importing, setImporting] = useState(false)
  const [cardModal, setCardModal] = useState<{ card: LearnCard | null } | null>(null)
  const [search, setSearch] = useState('')

  const topic = (topics.data ?? []).find((t) => t.id === id)
  if (topics.isLoading || cards.isLoading) return <Spinner />
  if (!topic || !id) return <EmptyState title="הנושא לא נמצא" />

  const all = cards.data ?? []
  const mine = (progress.data ?? []).filter((p) => p.topic_id === id)
  const known = new Set(mine.filter((p) => p.known).map((p) => p.card_id))
  const myAttempts = (attempts.data ?? []).filter((a) => a.topic_id === id)
  const shown = search.trim() ? all.filter((c) => (c.question + ' ' + c.answer).toLowerCase().includes(search.trim().toLowerCase())) : all

  return (
    <div className="space-y-4">
      <Link to="/learn" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={15} /> כל הנושאים
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{topic.title}</h1>
          <p className="text-sm text-slate-500">
            {all.length} שאלות · ידוע {known.size} ({all.length ? Math.round((known.size / all.length) * 100) : 0}%)
            {myAttempts[0] && ` · מבחן אחרון ${myAttempts[0].score}/${myAttempts[0].total} (${formatDate(myAttempts[0].taken_at.slice(0, 10))})`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mine.length > 0 && (
            <ConfirmButton className="btn-ghost text-xs" message="לאפס את ההתקדמות שלך בנושא הזה?" onConfirm={() => reset.mutate(id)}>
              <RotateCcw size={14} /> איפוס התקדמות
            </ConfirmButton>
          )}
          {isAdmin && (
            <>
              <button className="btn-secondary" onClick={() => setImporting(true)}>
                <FileUp size={15} /> ייבוא שאלות
              </button>
              <button
                className="btn-ghost !px-2"
                aria-label="שינוי שם"
                onClick={() => {
                  const title = window.prompt('שם הנושא', topic.title)
                  if (title?.trim()) saveTopic.mutate({ id, title, description: topic.description })
                }}
              >
                <Pencil size={15} />
              </button>
              <ConfirmButton
                className="btn-ghost !px-2 text-red-500"
                message={`למחוק את הנושא "${topic.title}" עם כל השאלות וההתקדמות של כל המשתמשים?`}
                onConfirm={() => delTopic.mutate(id, { onSuccess: () => navigate('/learn') })}
              >
                <Trash2 size={15} />
              </ConfirmButton>
            </>
          )}
        </div>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="flash">כרטיסיות</Tab>
          <Tab id="quiz">מבחן</Tab>
          <Tab id="list">כל השאלות ({all.length})</Tab>
        </TabList>
        <TabPanel id="flash">
          <FlashStudy cards={all} progress={mine} />
        </TabPanel>
        <TabPanel id="quiz">
          <QuizStudy topicId={id} cards={all} progress={mine} />
        </TabPanel>
        <TabPanel id="list">
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" className="input !w-64" placeholder="חיפוש בשאלות ותשובות…" dir="ltr" value={search} onChange={(e) => setSearch(e.target.value)} />
            {isAdmin && (
              <button className="btn-secondary" onClick={() => setCardModal({ card: null })}>
                <Plus size={15} /> שאלה
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <EmptyState title={all.length === 0 ? 'אין עדיין שאלות' : 'לא נמצאו שאלות'} hint={isAdmin && all.length === 0 ? 'לחץ על "ייבוא שאלות" או הוסף שאלה ידנית' : undefined} />
          ) : (
            <ul className="space-y-2">
              {shown.map((c) => (
                <li key={c.id} className="card p-3" dir="ltr">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-left text-sm font-medium text-slate-800">{c.question}</p>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className={classNames('h-2 w-2 rounded-full', known.has(c.id) ? 'bg-emerald-500' : 'bg-slate-200')} title={known.has(c.id) ? 'ידוע' : 'עוד לא ידוע'} />
                      {isAdmin && (
                        <>
                          <button className="btn-ghost !px-1.5" aria-label="עריכה" onClick={() => setCardModal({ card: c })}>
                            <Pencil size={13} />
                          </button>
                          <ConfirmButton className="btn-ghost !px-1.5 text-red-500" message="למחוק את השאלה?" onConfirm={() => delCard.mutate(c.id)}>
                            <Trash2 size={13} />
                          </ConfirmButton>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-left text-sm text-slate-600">{c.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      </Tabs>

      {importing && <LearnImport topicId={id} topicTitle={topic.title} onClose={() => setImporting(false)} />}
      {cardModal && <CardModal topicId={id} card={cardModal.card} onClose={() => setCardModal(null)} />}
    </div>
  )
}
