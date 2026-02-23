import type { CurrencyInfo, FormatCurrencyOptions } from './types.js';

const MAX_CACHE_SIZE = 50;
const currencyFormatCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${options.currency}|${options.minimumFractionDigits ?? ''}|${options.maximumFractionDigits ?? ''}|${options.currencyDisplay ?? ''}`;
  let fmt = currencyFormatCache.get(key);
  if (!fmt) {
    if (currencyFormatCache.size >= MAX_CACHE_SIZE) {
      currencyFormatCache.clear();
    }
    fmt = new Intl.NumberFormat(locale, options);
    currencyFormatCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Format a monetary value according to locale and currency rules.
 *
 * @param amount        - Numeric value or Decimal string (API returns monetary
 *                        fields as strings to preserve Decimal(19,4) precision).
 * @param currencyOrCode - ISO 4217 currency code (e.g., 'GBP') or a CurrencyInfo
 *                         object. When CurrencyInfo is passed, its minorUnit is
 *                         used automatically unless overridden via options.
 * @param locale        - BCP 47 locale string (e.g., 'en-GB').
 * @param options       - Optional overrides (minorUnit, useSymbol).
 * @returns Formatted currency string (e.g., "£1,234.56"), or empty string for
 *          invalid amounts or unrecognised currency codes.
 */
export function formatCurrency(
  amount: string | number,
  currencyOrCode: string | CurrencyInfo,
  locale: string,
  options?: FormatCurrencyOptions,
): string {
  const numeric = Number(amount);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return '';
  }

  const currencyCode = typeof currencyOrCode === 'string'
    ? currencyOrCode
    : currencyOrCode.code;
  const minorUnit = typeof currencyOrCode === 'string'
    ? options?.minorUnit
    : (options?.minorUnit ?? currencyOrCode.minorUnit);

  const intlOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currencyCode,
  };

  if (minorUnit !== undefined) {
    intlOptions.minimumFractionDigits = minorUnit;
    intlOptions.maximumFractionDigits = minorUnit;
  }

  if (options?.useSymbol === false) {
    intlOptions.currencyDisplay = 'code';
  }

  try {
    return getCurrencyFormat(locale, intlOptions).format(numeric);
  } catch (err) {
    console.warn(`formatCurrency: failed to format ${currencyCode} — ${(err as Error).message}`);
    return '';
  }
}
