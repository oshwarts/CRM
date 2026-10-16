import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react'
import { BrandLogo } from '../BrandLogo'
import { stuckText, type TeamModel } from '../../lib/teamStats'
import { classNames, formatDate, todayISO } from '../../lib/utils'
import { BigNumber, FunnelBars, Meter, TrendBars } from './TeamCharts'

function Slide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-6 px-6 py-8 sm:px-14">
      <h2 className="border-r-8 border-[#cc3366] pr-4 text-3xl font-semibold text-[#00326d] sm:text-5xl">{title}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

/** a full-screen, clean view for a meeting: big numbers and charts, arrows to move, Esc to close */
export function Presentation({ model, onClose }: { model: TeamModel; onClose: () => void }) {
  const [i, setI] = useState(0)
  const { kpis } = model

  // always light, whatever the app theme is
  useEffect(() => {
    const root = document.documentElement
    const was = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      if (was) root.classList.add('dark')
    }
  }, [])

  const withGoals = model.agents.filter((r) => r.goalsCount > 0)
  const slides: { key: string; node: React.ReactNode }[] = [
    {
      key: 'title',
      node: (
        <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#00326d] to-[#1863dc] px-6 text-center text-white">
          <BrandLogo size="lg" light className="!h-20" />
          <h1 className="text-4xl font-semibold !text-white sm:text-6xl">ביצועי צוות</h1>
          <p className="text-2xl text-white/85 sm:text-3xl">{model.period.label}</p>
          <p className="text-sm text-white/60">{formatDate(todayISO())}</p>
        </div>
      ),
    },
    {
      key: 'kpis',
      node: (
        <Slide title="המספרים של התקופה">
          <div className="grid h-full grid-cols-2 content-center gap-5 [&_.card]:p-6 [&_p:nth-child(2)]:!text-6xl [&_p:first-child]:!text-lg">
            <BigNumber label="ניתוחי MAKO" value={kpis.surgeries.value} delta={kpis.surgeries} />
            <BigNumber label="פגישות שהתקיימו" value={kpis.meetings.value} delta={kpis.meetings} />
            <BigNumber label="עמידה ביעדים" value={kpis.hasGoals ? kpis.goals.value : null} suffix="%" delta={kpis.goals} points />
            <BigNumber label="התקדמות בהכשרות" value={kpis.training.pct} suffix="%" sub={kpis.training.stuck > 0 ? stuckText(kpis.training.stuck) : 'אין הכשרות תקועות'} />
          </div>
        </Slide>
      ),
    },
    {
      key: 'trend',
      node: (
        <Slide title="מגמה לאורך החודשים">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-2 text-xl font-semibold text-[#00326d]">ניתוחי MAKO</h3>
              <TrendBars series={model.series} field="surgeries" height={200} />
            </div>
            <div className="card p-5">
              <h3 className="mb-2 text-xl font-semibold text-[#00326d]">פגישות שהתקיימו</h3>
              <TrendBars series={model.series} field="meetings" height={200} />
            </div>
          </div>
        </Slide>
      ),
    },
    {
      key: 'goals',
      node: (
        <Slide title="עמידה ביעדים לפי סוכן">
          {withGoals.length === 0 ? (
            <p className="text-2xl text-slate-500">לא הוגדרו יעדים לתקופה.</p>
          ) : (
            <ul className="space-y-5">
              {withGoals.map((r) => (
                <li key={r.agent.id} className="flex items-center gap-4">
                  <span className="w-48 shrink-0 truncate text-2xl font-medium text-slate-800">{r.agent.full_name || r.agent.email}</span>
                  <div className="flex-1 [&>span>span:first-child]:!h-5 [&>span>span:last-child]:!w-16 [&>span>span:last-child]:!text-xl">
                    <Meter pct={r.goalsAvg} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Slide>
      ),
    },
    {
      key: 'funnel',
      node: (
        <Slide title="משפך רופאים פוטנציאליים">
          <p className="mb-4 text-xl text-slate-600">
            {model.potentialTotal} רופאים בפיפליין, {model.closing} מהם בשלבי משא ומתן וסגירה
          </p>
          <FunnelBars funnel={model.funnel} big />
        </Slide>
      ),
    },
    {
      key: 'training',
      node: (
        <Slide title="הכשרה וידע">
          <ul className="space-y-5">
            {model.agents.map((r) => (
              <li key={r.agent.id} className="flex items-center gap-4">
                <span className="w-48 shrink-0 truncate text-2xl font-medium text-slate-800">{r.agent.full_name || r.agent.email}</span>
                <div className="flex-1 [&>span>span:first-child]:!h-5 [&>span>span:last-child]:!w-16 [&>span>span:last-child]:!text-xl">
                  <Meter pct={r.training.pct} />
                </div>
                {r.training.stuck > 0 && <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">{r.training.stuck === 1 ? 'תקועה אחת' : `${r.training.stuck} תקועות`}</span>}
              </li>
            ))}
          </ul>
        </Slide>
      ),
    },
    {
      key: 'summary',
      node: (
        <Slide title="סיכום ומה הלאה">
          <ul className="list-disc space-y-3 pr-8 text-2xl leading-relaxed text-slate-800">
            {model.summary.map((s, k) => (
              <li key={k}>{s}</li>
            ))}
          </ul>
        </Slide>
      ),
    },
  ]

  const last = slides.length - 1
  const next = () => setI((x) => Math.min(last, x + 1))
  const prev = () => setI((x) => Math.max(0, x - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the page is right-to-left: the left arrow goes forward
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, last]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-white text-slate-800" role="dialog" aria-modal="true" aria-label="מצגת">
      <div className="min-h-0 flex-1">{slides[i].node}</div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-2">
        <div className="flex items-center gap-1">
          <button className="btn-secondary !px-2" onClick={prev} disabled={i === 0} aria-label="שקף קודם">
            <ChevronRight size={20} />
          </button>
          <button className="btn-secondary !px-2" onClick={next} disabled={i === last} aria-label="שקף הבא">
            <ChevronLeft size={20} />
          </button>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          {slides.map((s, k) => (
            <button key={s.key} onClick={() => setI(k)} className={classNames('h-2.5 rounded-full transition-all', k === i ? 'w-6 bg-[#00326d]' : 'w-2.5 bg-slate-300')} tabIndex={-1} />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost !px-2" onClick={() => void document.documentElement.requestFullscreen?.()} aria-label="מסך מלא" title="מסך מלא">
            <Maximize size={18} />
          </button>
          <button className="btn-secondary !px-2" onClick={onClose} aria-label="סגור מצגת">
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
