import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { i18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Global error boundary wrapping the root application.
 *
 * - On error → displays a friendly "Something went wrong" page (translated)
 * - Includes a "Reload" button to recover
 * - Logs error details to console in development only
 * - Never shows raw stack traces to users
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}

/**
 * Fallback UI rendered when the error boundary catches an error.
 *
 * Uses the i18n singleton directly (not React hooks) because the
 * component tree has crashed and React context providers may be
 * unavailable. The i18n singleton is a plain JS object that works
 * outside React.
 */
function ErrorFallback({ onReload }: { onReload: () => void }) {
  const t = (key: string, fallback: string) => {
    const result = i18n.t(key);
    return result === key ? fallback : result;
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background"
      role="main"
      aria-labelledby="error-boundary-heading"
    >
      <div className="text-center">
        <h1
          id="error-boundary-heading"
          className="text-4xl font-bold text-foreground"
        >
          500
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {t('common:somethingWentWrong', 'Something went wrong')}
        </p>
        <Button onClick={onReload} className="mt-6">
          {t('common:reload', 'Reload')}
        </Button>
      </div>
    </main>
  );
}
