import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary. Catches any render / lifecycle error in the tree
 * and shows a recoverable error screen instead of a blank white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
          <div className="max-w-lg w-full space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-destructive text-2xl">⚠</span>
              <h1 className="text-xl font-bold font-mono tracking-tight">
                APPLICATION ERROR
              </h1>
            </div>
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded font-mono text-sm text-destructive break-all">
              {this.state.error?.message ?? 'Unknown error'}
            </div>
            <p className="text-muted-foreground text-sm">
              The application encountered an unexpected error. Try refreshing the page.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded font-mono text-sm hover:bg-primary/90 transition-colors"
            >
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
