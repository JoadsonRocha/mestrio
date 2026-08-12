import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-red-700">Algo inesperado aconteceu</h2>
            <p className="mt-2 text-sm text-red-600">
              Não foi possível carregar esta parte do aplicativo. Tente novamente em instantes.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
