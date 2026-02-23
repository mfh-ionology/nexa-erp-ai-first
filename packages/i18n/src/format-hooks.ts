import { useMemo } from 'react';
import { useLocale } from './hooks.js';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatPercent,
} from '@nexa/shared';
import type { CurrencyInfo, FormatCurrencyOptions, DateFormatPreset } from '@nexa/shared';

/**
 * Returns a `formatCurrency` function bound to the current locale.
 *
 * Usage:
 * ```tsx
 * const fc = useFormatCurrency();
 * fc('1234.56', 'GBP', { minorUnit: 2 })  // "£1,234.56"
 * fc('1234.56', currencyInfo)              // uses CurrencyInfo.minorUnit
 * ```
 */
export function useFormatCurrency() {
  const locale = useLocale();
  return useMemo(
    () =>
      (amount: string | number, currencyOrCode: string | CurrencyInfo, options?: FormatCurrencyOptions) =>
        formatCurrency(amount, currencyOrCode, locale, options),
    [locale],
  );
}

/**
 * Returns a `formatNumber` function bound to the current locale.
 */
export function useFormatNumber() {
  const locale = useLocale();
  return useMemo(
    () =>
      (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
    [locale],
  );
}

/**
 * Returns a `formatDate` function bound to the current locale.
 */
export function useFormatDate() {
  const locale = useLocale();
  return useMemo(
    () =>
      (date: Date | string, format?: DateFormatPreset) =>
        formatDate(date, locale, format),
    [locale],
  );
}

/**
 * Returns a `formatDateTime` function bound to the current locale.
 */
export function useFormatDateTime() {
  const locale = useLocale();
  return useMemo(
    () =>
      (date: Date | string, format?: DateFormatPreset) =>
        formatDateTime(date, locale, format),
    [locale],
  );
}

/**
 * Returns a `formatPercent` function bound to the current locale.
 */
export function useFormatPercent() {
  const locale = useLocale();
  return useMemo(
    () =>
      (value: number, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) =>
        formatPercent(value, locale, options),
    [locale],
  );
}
