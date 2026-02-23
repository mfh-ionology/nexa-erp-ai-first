const MAX_CACHE_SIZE = 50;
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${options?.style ?? ''}|${options?.minimumFractionDigits ?? ''}|${options?.maximumFractionDigits ?? ''}|${options?.minimumIntegerDigits ?? ''}|${options?.minimumSignificantDigits ?? ''}|${options?.maximumSignificantDigits ?? ''}`;
  let fmt = numberFormatCache.get(key);
  if (!fmt) {
    if (numberFormatCache.size >= MAX_CACHE_SIZE) {
      numberFormatCache.clear();
    }
    fmt = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Format a number according to locale conventions.
 *
 * @param value   - Numeric value to format.
 * @param locale  - BCP 47 locale string.
 * @param options - Optional Intl.NumberFormatOptions overrides.
 * @returns Formatted number string (e.g., "1,234.56" for en-GB).
 *          Returns empty string for NaN, returns "Infinity"/"-Infinity" for infinite values.
 */
export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  if (Number.isNaN(value)) {
    return '';
  }
  if (!Number.isFinite(value)) {
    return String(value);
  }

  return getNumberFormat(locale, options).format(value);
}
