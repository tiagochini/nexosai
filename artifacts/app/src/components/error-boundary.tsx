import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] caught:", error.message, info.componentStack?.slice(0, 300));
    this.setState({ errorInfo: info.componentStack?.slice(0, 300) });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-lg w-full border border-destructive/30 bg-destructive/5 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <div className="font-mono font-bold text-sm uppercase tracking-widest text-destructive">
                  Erro inesperado
                </div>
                <div className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                  A página encontrou um problema
                </div>
              </div>
            </div>

            {this.state.error?.message && (
              <div className="font-mono text-xs text-muted-foreground/70 bg-muted/10 border border-border/30 p-3 break-words">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest border border-primary/40 text-primary px-4 py-2 hover:bg-primary/10 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
              <a
                href="/"
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest border border-border/40 text-muted-foreground px-4 py-2 hover:border-border/70 transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                Ir para início
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
