import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileUp, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import {
  useCanEditLearning,
  useDeleteCard,
  useDeleteTopic,
  useLearnAttempts,
  useLearnCards,
  useLearnProgress,
  useLearnTopics,
  useResetProgress,
  useLessons,
  useSaveTopic,
  useTracks,
} from '../lib/learnApi'
import type { LearnCard } from '../lib/types'
import { FlashStudy, QuizStudy } from '../components/LearnStudy'
import { LearnImport } from '../components/LearnImport'
import { LearnImage } from '../components/LearnMedia'
import { LearnCardModal } from '../components/LearnCardModal'
import { ApprovalTag, CasesPanel, LessonsPanel, SequencesPanel } from '../components/LearnContent'
import { ClozeStudy, MatchStudy, TrueFalseStudy } from '../components/LearnModes'
import { ConfirmButton, EmptyState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { classNames, formatDate } from '../lib/utils'

export default function LearnTopic() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const canEdit = useCanEditLearning()
  const topics = useLearnTopics()
  const cards = useLearnCards(id)
  const progress = useLearnProgress(user?.id)
  const attempts = useLearnAttempts(user?.id)
  const tracks = useTracks()
  const saveTopic = useSaveTopic()
  const delTopic = useDeleteTopic()
  const delCard = useDeleteCard()
  const reset = useResetProgress()
  const [params, setParams] = useSearchParams()
  const lessons = useLessons(id)
  const lessonFilter = params.get('lesson')
  const [tab, setTab] = useState(params.get('tab') ?? 'lessons')
  const [importing, setImporting] = useState(false)
  const [cardModal, setCardModal] = useState<{ card: LearnCard | null } | null>(null)
  const [search, setSearch] = useState('')

  const topic = (topics.data ?? []).find((t) => t.id === id)
  if (topics.isLoading || cards.isLoading) return <Spinner />
  if (!topic || !id) return <EmptyState title="הנושא לא נמצא" />

  // the cards agents study are the approved ones; editors also see (and mark) what waits for approval
  const all = cards.data ?? []
  const studied = all.filter((c) => c.approved && (!lessonFilter || c.lesson_id === lessonFilter))
  const filterLesson = (lessons.data ?? []).find((l) => l.id === lessonFilter)
  const mine = (progress.data ?? []).filter((p) => p.topic_id === id)
  const known = new Set(mine.filter((p) => p.known).map((p) => p.card_id))
  const myAttempts = (attempts.data ?? []).filter((a) => a.topic_id === id)
  const passPct = (tracks.data ?? []).flatMap((t) => t.items).find((i) => i.topic_id === id)?.pass_pct
  const knownCount = studied.filter((c) => known.has(c.id)).length
  const knownPct = studied.length ? Math.round((knownCount / studied.length) * 100) : 0
  const shown = search.trim() ? all.filter((c) => (c.question + ' ' + c.answer).toLowerCase().includes(search.trim().toLowerCase())) : all

  return (
    <div className="space-y-4">
      <Link to="/learn" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={15} /> כל הנושאים
      </Link>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h1 dir="auto" className="min-w-0 break-words text-2xl font-semibold text-brand-800 sm:text-3xl">{topic.title}</h1>
          {isAdmin && (
            <span className="flex shrink-0 gap-1">
              <button
                className="btn-ghost !px-2"
                aria-label="שינוי שם"
                onClick={() => {
                  const title = window.prompt('שם הנושא', topic.title)
                  if (title?.trim()) saveTopic.mutate({ id, title, description: topic.description })
                }}
              >
                <Pencil size={16} />
              </button>
              <ConfirmButton
                className="btn-ghost !px-2 text-red-500"
                message={`למחוק את הנושא "${topic.title}" עם כל התוכן וההתקדמות של כל המשתמשים?`}
                onConfirm={() => delTopic.mutate(id, { onSuccess: () => navigate('/learn') })}
              >
                <Trash2 size={16} />
              </ConfirmButton>
            </span>
          )}
        </div>
        <div className="card space-y-2 p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold leading-tight text-slate-800">{studied.length}</p>
              <p className="text-xs text-slate-500">שאלות</p>
            </div>
            <div>
              <p className="text-xl font-bold leading-tight text-slate-800">{knownPct}%</p>
              <p className="text-xs text-slate-500">ידוע ({knownCount})</p>
            </div>
            <div>
              <p className="text-xl font-bold leading-tight text-slate-800">{myAttempts[0] ? `${myAttempts[0].score}/${myAttempts[0].total}` : '—'}</p>
              <p className="text-xs text-slate-500">{myAttempts[0] ? `מבחן אחרון, ${formatDate(myAttempts[0].taken_at.slice(0, 10))}` : 'עוד לא נבחנת'}</p>
            </div>
          </div>
          <div role="progressbar" aria-label="אחוז השאלות הידועות" aria-valuemin={0} aria-valuemax={100} aria-valuenow={knownPct} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-500" style={{ width: `${knownPct}%` }} />
          </div>
          {passPct !== undefined && <p className="text-xs text-slate-500">ציון עובר במבחן: {passPct}%</p>}
        </div>
        {(mine.length > 0 || canEdit) && (
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button className="btn-secondary" onClick={() => setImporting(true)}>
                <FileUp size={15} /> ייבוא שאלות
              </button>
            )}
            {mine.length > 0 && (
              <ConfirmButton className="btn-ghost text-xs" message="לאפס את ההתקדמות שלך בנושא הזה?" onConfirm={() => reset.mutate(id)}>
                <RotateCcw size={14} /> איפוס התקדמות
              </ConfirmButton>
            )}
          </div>
        )}
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="lessons">שיעורים</Tab>
          <Tab id="flash">כרטיסיות</Tab>
          <Tab id="quiz">מבחן</Tab>
          <Tab id="tf">נכון / לא נכון</Tab>
          <Tab id="cloze">השלמה</Tab>
          <Tab id="match">התאמה</Tab>
          <Tab id="order">סדר נכון</Tab>
          <Tab id="cases">מקרים קליניים</Tab>
          <Tab id="list">כל השאלות ({all.length})</Tab>
        </TabList>
        <TabPanel id="lessons">
          <LessonsPanel topicId={id} topicTitle={topic.title} />
        </TabPanel>
        {lessonFilter && tab !== 'lessons' && tab !== 'cases' && tab !== 'list' && tab !== 'order' && (
          <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            מתרגל רק את שאלות השיעור: {filterLesson?.title ?? ''}
            <button className="text-xs underline" onClick={() => setParams({}, { replace: true })}>
              חזרה לכל שאלות הנושא
            </button>
          </p>
        )}
        <TabPanel id="flash">
          <FlashStudy key={lessonFilter ?? 'all'} cards={studied} progress={mine} />
        </TabPanel>
        <TabPanel id="quiz">
          <QuizStudy key={lessonFilter ?? 'all'} topicId={id} cards={studied} progress={mine} passPct={lessonFilter ? undefined : passPct} />
        </TabPanel>
        <TabPanel id="tf">
          <TrueFalseStudy key={lessonFilter ?? 'all'} cards={studied} progress={mine} />
        </TabPanel>
        <TabPanel id="cloze">
          <ClozeStudy key={lessonFilter ?? 'all'} cards={studied} progress={mine} />
        </TabPanel>
        <TabPanel id="match">
          <MatchStudy key={lessonFilter ?? 'all'} cards={studied} progress={mine} />
        </TabPanel>
        <TabPanel id="order">
          <SequencesPanel topicId={id} />
        </TabPanel>
        <TabPanel id="cases">
          <CasesPanel topicId={id} />
        </TabPanel>
        <TabPanel id="list">
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" aria-label="חיפוש בשאלות ותשובות" className="input min-w-0 flex-1 sm:!w-64 sm:flex-none" placeholder="חיפוש בשאלות ותשובות…" dir="auto" value={search} onChange={(e) => setSearch(e.target.value)} />
            {canEdit && (
              <button className="btn-secondary shrink-0" onClick={() => setCardModal({ card: null })}>
                <Plus size={15} /> שאלה
              </button>
            )}
          </div>
          {shown.length === 0 ? (
            <EmptyState title={all.length === 0 ? 'אין עדיין שאלות' : 'לא נמצאו שאלות'} hint={canEdit && all.length === 0 ? 'לחץ על "ייבוא שאלות" או הוסף שאלה ידנית' : undefined} />
          ) : (
            <ul className="space-y-2">
              {shown.map((c) => (
                <li key={c.id} className="card p-3" dir="ltr">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-left text-sm font-medium text-slate-800">{c.question}</p>
                    <span className="flex shrink-0 items-center gap-1" dir="rtl">
                      <ApprovalTag approved={c.approved} table="learn_cards" id={c.id} topicId={id} label={c.question} />
                      <span role="img" aria-label={known.has(c.id) ? 'ידוע' : 'עוד לא ידוע'} className={classNames('h-2.5 w-2.5 rounded-full', known.has(c.id) ? 'bg-emerald-500' : 'bg-slate-300')} title={known.has(c.id) ? 'ידוע' : 'עוד לא ידוע'} />
                      {canEdit && (
                        <>
                          <button className="btn-ghost !px-2" aria-label="עריכה" onClick={() => setCardModal({ card: c })}>
                            <Pencil size={15} />
                          </button>
                          <ConfirmButton className="btn-ghost !px-2 text-red-500" message="למחוק את השאלה?" onConfirm={() => delCard.mutate(c.id)}>
                            <Trash2 size={15} />
                          </ConfirmButton>
                        </>
                      )}
                    </span>
                  </div>
                  {c.image_path && <LearnImage path={c.image_path} className="mt-2 max-h-40" />}
                  <p className="mt-1 whitespace-pre-wrap text-left text-sm text-slate-600">{c.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      </Tabs>

      {importing && <LearnImport topicId={id} topicTitle={topic.title} onClose={() => setImporting(false)} />}
      {cardModal && <LearnCardModal topicId={id} card={cardModal.card} lessons={lessons.data} onClose={() => setCardModal(null)} />}
    </div>
  )
}
