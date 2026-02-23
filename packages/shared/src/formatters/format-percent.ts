const MAX_CACHE_SIZE = 50;
const percentFormatCache = new Map<string, Intl.NumberFormat>();

function getPercentFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|percent|${options.minimumFractionDigits ?? ''}|${options.maximumFractionDigits ?? ''}`;
  let fmt = percentFormatCache.get(key);
  if (!fmt) {
    if (percentFormatCache.size >= MAX_CACHE_SIZE) {
      percentFormatCache.clear();
    }
    fmt = new Intl.NumberFormat(locale, options);
    percentFormatCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Format a decimal value as a percentage.
 *
 * @param value   - Decimal fraction (0.0 to 1.0). 0.15 → "15%".
 * @param locale  - BCP 47 locale string.
 * @param options - Optional: { minimumFractionDigits, maximumFractionDigits }.
 * @returns Formatted percentage string (e.g., "15%" or "15.50%").
 */
export function formatPercent(
  value: number,
  locale: string,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return '';
  }

  const intlOptions: Intl.NumberFormatOptions = {
    style: 'percent',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  };

  return getPercentFormat(locale, intlOptions).format(value);
}
