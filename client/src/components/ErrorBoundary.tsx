import { Component } from "react"
import type { ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import NexusButton from "./ui/NexusButton"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-nexus-bg p-4">
          <div className="max-w-sm w-full rounded-2xl bg-nexus-card/80 border border-nexus-border/50 p-8 text-center shadow-xl backdrop-blur-xl">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-nexus-text">Something went wrong</h2>
            <p className="mb-6 text-sm text-nexus-muted">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <NexusButton onClick={() => window.location.reload()}>
              Reload Page
            </NexusButton>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
