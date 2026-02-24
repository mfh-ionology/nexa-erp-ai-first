import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Info,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { PeriodComparison } from './period-comparison';
import type { BriefingCardConfig } from '../templates/types';

interface SeverityStyle {
  colorClass: string;
  icon: LucideIcon;
}

const DEFAULT_SEVERITY: SeverityStyle = {
  colorClass: 'border-l-blue-500',
  icon: Info,
};

const SEVERITY_STYLES: Record<string, SeverityStyle> = {
  info: DEFAULT_SEVERITY,
  warning: {
    colorClass: 'border-l-amber-500',
    icon: AlertTriangle,
  },
  error: {
    colorClass: 'border-l-red-500',
    icon: Bell,
  },
};

/**
 * A briefing card that renders one of three card types:
 * - **KPI**: Displays a metric value with optional period-over-period comparison
 * - **Action**: Displays a prompt with an action button (e.g., "3 invoices awaiting approval")
 * - **Alert**: Displays a severity-coloured alert with action button
 */
export function BriefingCard({ config }: { config: BriefingCardConfig }) {
  const { t } = useI18n();

  const handleAction = () => {
    config.onAction?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && config.onAction) {
      e.preventDefault();
      config.onAction();
    }
  };

  // --- KPI card ---
  if (config.type === 'kpi') {
    return (
      <Card
        className="transition-shadow hover:shadow-md"
        tabIndex={config.onAction ? 0 : undefined}
        onKeyDown={config.onAction ? handleKeyDown : undefined}
        role={config.onAction ? 'button' : undefined}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t(config.titleKey)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {config.value ?? '—'}
            </span>
            {config.previousValue && config.value && (
              <PeriodComparison
                current={config.value}
                previous={config.previousValue}
                format={config.format ?? 'number'}
              />
            )}
          </div>
          {config.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {config.description}
            </p>
          )}
        </CardContent>
        {config.actionLabelKey && config.onAction && (
          <CardFooter>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-primary"
              onClick={(e) => {
                e.stopPropagation();
                handleAction();
              }}
            >
              {t(config.actionLabelKey)}
              <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  // --- Action card ---
  if (config.type === 'action') {
    return (
      <Card
        className="transition-shadow hover:shadow-md"
        tabIndex={config.onAction ? 0 : undefined}
        onKeyDown={config.onAction ? handleKeyDown : undefined}
        role={config.onAction ? 'button' : undefined}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t(config.titleKey)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {config.value && (
            <p className="text-2xl font-bold tracking-tight">{config.value}</p>
          )}
          {config.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {config.description}
            </p>
          )}
        </CardContent>
        {config.actionLabelKey && config.onAction && (
          <CardFooter>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAction();
              }}
            >
              {t(config.actionLabelKey)}
              <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  // --- Alert card ---
  const severityConfig = SEVERITY_STYLES[config.severity ?? 'info'] ?? DEFAULT_SEVERITY;
  const SeverityIcon = severityConfig.icon;

  return (
    <Card
      className={cn(
        'border-l-4 transition-shadow hover:shadow-md',
        severityConfig.colorClass,
      )}
      tabIndex={config.onAction ? 0 : undefined}
      onKeyDown={config.onAction ? handleKeyDown : undefined}
      role="alert"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <SeverityIcon
            className={cn(
              'size-4',
              config.severity === 'error' && 'text-red-500',
              config.severity === 'warning' && 'text-amber-500',
              config.severity === 'info' && 'text-blue-500',
            )}
            aria-hidden="true"
          />
          <CardTitle className="text-sm font-semibold">
            {t(config.titleKey)}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </CardContent>
      {config.actionLabelKey && config.onAction && (
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleAction();
            }}
          >
            {t(config.actionLabelKey)}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
