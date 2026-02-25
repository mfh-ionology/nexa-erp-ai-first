import { createFileRoute, Link } from '@tanstack/react-router';
import { ShieldX } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/403')({
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const { t } = useI18n();

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-4"
      role="main"
      aria-labelledby="access-denied-heading"
    >
      <div className="w-full max-w-[450px] text-center">
        {/* Icon */}
        <div
          className="animate-fade-in-up mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
        >
          <ShieldX className="h-8 w-8 text-[#ef4444]" />
        </div>

        {/* 403 Display */}
        <h1
          id="access-denied-heading"
          className="animate-fade-in-up font-serif text-6xl font-bold text-foreground"
          style={{ animationDelay: '50ms' }}
        >
          {t('errors:accessDeniedTitle')}
        </h1>

        {/* Description */}
        <p
          className="animate-fade-in-up mt-3 text-base font-medium text-foreground"
          style={{ animationDelay: '100ms' }}
        >
          {t('errors:accessDenied')}
        </p>
        <p
          className="animate-fade-in-up mt-2 text-sm text-muted-foreground"
          style={{ animationDelay: '100ms' }}
        >
          {t('errors:accessDeniedDescription')}
        </p>
        <p
          className="animate-fade-in-up mt-1 text-sm font-medium text-foreground"
          style={{ animationDelay: '100ms' }}
        >
          {t('errors:contactAdmin')}
        </p>

        {/* CTA */}
        <div className="animate-fade-in-up mt-6" style={{ animationDelay: '150ms' }}>
          <Button asChild className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Link to="/">{t('errors:backToDashboard')}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
