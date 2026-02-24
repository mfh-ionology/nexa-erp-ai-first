import { Separator } from '@/components/ui/separator';

import { useI18n } from '@nexa/i18n';

import type { TotalsConfig } from './types';

export interface TotalsSectionProps {
  /** Totals configuration */
  totals: TotalsConfig;
}

/**
 * Right-aligned totals section for Header+Lines documents (T3).
 *
 * Displays subtotal, optional additional lines, optional VAT, and total.
 * All labels use translation keys.
 */
export function TotalsSection({ totals }: TotalsSectionProps) {
  const { t } = useI18n();

  return (
    <div
      className="flex justify-end"
      role="region"
      aria-label={t('total')}
    >
      <div className="w-full max-w-xs space-y-1.5">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('subtotal')}</span>
          <span>{totals.subtotal}</span>
        </div>

        {/* Additional lines (e.g., discount, shipping) */}
        {totals.additionalLines?.map((line) => (
          <div
            key={line.labelKey}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{t(line.labelKey)}</span>
            <span>{line.value}</span>
          </div>
        ))}

        {/* VAT */}
        {totals.vatAmount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t('vatAmount', { rate: totals.vatRate ?? '20%' })}
            </span>
            <span>{totals.vatAmount}</span>
          </div>
        )}

        <Separator />

        {/* Total — bold and slightly larger */}
        <div className="flex items-center justify-between font-semibold text-base">
          <span>{t('total')}</span>
          <span>{totals.total}</span>
        </div>
      </div>
    </div>
  );
}
