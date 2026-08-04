import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/** Contains a crash to the panel that caused it.
 *
 *  Without one, a single bad component unmounts the entire React tree — which includes
 *  the one persistent `<Canvas>` (HC-9). The WebGL context is destroyed, every GPU
 *  resource with it, and the console reports `Context Lost` as though the renderer were
 *  at fault. The actual fault was a selector in a side panel.
 *
 *  Wrapping each page and the viewport separately means a broken panel shows a message
 *  and everything else keeps running — including whatever was on screen. */
export class ErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept verbose on purpose: the component stack is what identifies the culprit, and
    // React only provides it here.
    console.error(`[${this.props.label}] crashed`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-sm space-y-2 text-center">
          <AlertTriangle className="w-5 h-5 text-aura-hot mx-auto" />
          <p className="text-[11px] text-slate-300">{this.props.label} stopped working.</p>
          <p className="text-[10px] text-slate-500 font-mono leading-snug break-words">
            {this.state.error.message}
          </p>
          <p className="text-[10px] text-slate-600 leading-snug">
            The rest of the app is still running. The console has the component stack.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded border border-aura-line text-[10px] text-slate-400 hover:text-slate-100 hover:bg-aura-surface transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Try again
          </button>
        </div>
      </div>
    )
  }
}
