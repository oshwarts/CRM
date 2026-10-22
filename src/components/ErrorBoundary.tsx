import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { reportClientError } from '../lib/errorLog'

type Props = { children: ReactNode; version: string }
type State = { error: Error | null }

/** a screen's file that could not be downloaded (a new version was published, or the connection dropped): trying again cannot help, loading the app again can */
const isChunkError = (e: Error) => /dynamically imported module|importing a module script|loading chunk|error loading dynamically|failed to fetch/i.test(e.message)

function HomeButton({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  return (
    <button
      className="btn-secondary"
      onClick={() => {
        onDone()
        navigate('/')
      }}
    >
      לדף הבית
    </button>
  )
}

/** a failure inside one screen shows a calm message with a way out, instead of a blank page; the menu stays usable */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error.message || 'render error', `${error.stack ?? ''}\n${info.componentStack ?? ''}`, this.props.version)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = isChunkError(error)
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle size={32} aria-hidden className="mx-auto text-amber-600" />
        <h2 className="text-lg font-semibold text-brand-800">{stale ? 'המסך לא נטען' : 'משהו השתבש במסך הזה'}</h2>
        <p className="text-sm text-slate-600">
          {stale
            ? 'ייתכן שיצאה גרסה חדשה של האפליקציה או שהחיבור לרשת נפל. רענון יטען אותה מחדש. מה שכבר נשמר לא אבד.'
            : 'הבעיה נרשמה אצלנו. אפשר לנסות שוב, לחזור לדף הבית או לרענן את האפליקציה. מה שכבר נשמר לא אבד.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {stale ? (
            <button className="btn-primary" onClick={() => window.location.reload()}>
              רענון
            </button>
          ) : (
            <>
              <button className="btn-primary" onClick={() => this.setState({ error: null })}>
                נסה שוב
              </button>
              <HomeButton onDone={() => this.setState({ error: null })} />
              <button className="btn-secondary" onClick={() => window.location.reload()}>
                רענון
              </button>
            </>
          )}
        </div>
      </div>
    )
  }
}
