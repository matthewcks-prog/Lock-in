import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ChatErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for Chat Section
 *
 * Prevents chat errors from crashing the entire sidebar.
 * Provides user-friendly error message and recovery options.
 */
export class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Chat error boundary caught error:', error, errorInfo);

    if (this.props.onError !== undefined) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    // Force reload by resetting component state
    window.location.hash = `#reset-${Date.now()}`;
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <div className="lockin-chat-error-boundary">
          <div className="lockin-error-icon" aria-hidden="true">
            !
          </div>
          <h3 className="lockin-error-title">Something went wrong</h3>
          <p className="lockin-error-message">
            The chat encountered an error and couldn&apos;t continue.
          </p>
          {this.state.error !== null && (
            <details className="lockin-error-details">
              <summary>Error details</summary>
              <pre className="lockin-error-stack">{this.state.error.toString()}</pre>
            </details>
          )}
          <div className="lockin-error-actions">
            <button className="lockin-btn-primary" onClick={this.handleReset} type="button">
              Try again
            </button>
            <button
              className="lockin-btn-secondary"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
