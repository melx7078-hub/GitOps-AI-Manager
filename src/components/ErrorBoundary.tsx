import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-6 m-4 bg-red-50 text-red-900 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-900 dark:text-red-200">
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <pre className="text-sm overflow-auto mb-4">{this.state.error?.message}</pre>
          <button 
            className="px-4 py-2 bg-red-100 font-medium text-red-800 rounded dark:bg-red-800 dark:text-red-100"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
