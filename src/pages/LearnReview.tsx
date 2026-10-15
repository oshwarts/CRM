import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useDueCards, useLearnProgress } from '../lib/learnApi'
import { FlashStudy } from '../components/LearnStudy'
import type { LearnCard } from '../lib/types'
import { EmptyState, Spinner } from '../components/ui'

/** the cards that are due today across all topics (spaced repetition) */
export default function LearnReview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const progress = useLearnProgress(user?.id)
  const due = useDueCards(user?.id, progress.data ?? [])
  // the session works on the cards that were due when it opened (answering changes what is due)
  const [snapshot, setSnapshot] = useState<LearnCard[] | null>(null)
  useEffect(() => {
    if (snapshot === null && due.data && !due.isFetching) setSnapshot(due.data)
  }, [snapshot, due.data, due.isFetching])
  if (progress.isLoading || (due.isLoading && snapshot === null)) return <Spinner />
  const cards = snapshot ?? due.data ?? []
  return (
    <div className="space-y-4">
      <Link to="/learn" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={15} /> לומדה
      </Link>
      <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">חזרה על שאלות</h1>
      {cards.length === 0 ? (
        <EmptyState title="אין שאלות לחזרה כרגע" hint="שאלות חוזרות בזמן הנכון אחרי שתענה עליהן בכרטיסיות או במבחן" />
      ) : (
        <FlashStudy cards={cards} progress={progress.data ?? []} auto onExit={() => navigate('/learn')} />
      )}
    </div>
  )
}
