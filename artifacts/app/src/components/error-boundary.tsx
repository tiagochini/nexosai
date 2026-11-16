import { Component, lazy, Suspense, type ReactNode } from "react";
import { isChunkLoadError } from "@/lib/chunk-recovery";

const ErrorFallback = lazy(() => import("@/components/error-fallback"));

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
    // React.lazy caches rejected imports; resetting state cannot retry them.
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <ErrorFallback error={this.state.error} onReset={this.handleReset} />
        </Suspense>
      );
    }

    return this.props.children;
  }
}
