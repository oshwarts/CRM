import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { reportClientError } from '../lib/errorLog'

type Props = { children: ReactNode; version: string }
type State = { error: Error | null }

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
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle size={32} className="mx-auto text-amber-600" />
        <h2 className="text-lg font-semibold text-brand-800">משהו השתבש במסך הזה</h2>
        <p className="text-sm text-slate-600">הבעיה נרשמה אצלנו. אפשר לנסות שוב, לחזור לדף הבית או לרענן את האפליקציה. מה שכבר נשמר לא אבד.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={() => this.setState({ error: null })}>
            נסה שוב
          </button>
          <a className="btn-secondary" href="/">
            לדף הבית
          </a>
          <button className="btn-secondary" onClick={() => window.location.reload()}>
            רענון
          </button>
        </div>
      </div>
    )
  }
}
