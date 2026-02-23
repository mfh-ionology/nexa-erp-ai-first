import type { DateFormatPreset } from './types.js';

const DATE_PRESETS: Record<DateFormatPreset, Intl.DateTimeFormatOptions> = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
};

const MAX_CACHE_SIZE = 50;
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let fmt = dateFormatCache.get(key);
  if (!fmt) {
    if (dateFormatCache.size >= MAX_CACHE_SIZE) {
      dateFormatCache.clear();
    }
    fmt = new Intl.DateTimeFormat(locale, options);
    dateFormatCache.set(key, fmt);
  }
  return fmt;
}

function parseDate(date: Date | string): Date | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date according to locale conventions.
 *
 * Uses UTC timezone to ensure date-only ISO strings (e.g., '2026-02-17')
 * do not shift to the previous day in negative-offset timezones. This is
 * intentional for an ERP where API dates are ISO 8601 strings parsed as
 * UTC midnight by the JavaScript Date constructor.
 *
 * @param date    - Date object or ISO 8601 string (API returns dates as
 *                  ISO strings, e.g., '2026-02-17' or '2026-02-17T10:30:00Z').
 * @param locale  - BCP 47 locale string.
 * @param format  - Preset: 'short' (17/02/2026), 'medium' (17 Feb 2026),
 *                  'long' (17 February 2026). Defaults to 'short'.
 * @returns Formatted date string.
 */
export function formatDate(
  date: Date | string,
  locale: string,
  format: DateFormatPreset = 'short',
): string {
  const parsed = parseDate(date);
  if (!parsed) return '';
  const mergedOptions = { ...DATE_PRESETS[format], timeZone: 'UTC' as const };
  return getDateFormat(locale, mergedOptions).format(parsed);
}

/**
 * Format a date with time according to locale conventions.
 *
 * Uses UTC timezone by default (see formatDate JSDoc for rationale).
 *
 * @param date    - Date object or ISO 8601 string.
 * @param locale  - BCP 47 locale string.
 * @param format  - Preset: 'short', 'medium', 'long'. Defaults to 'short'.
 * @returns Formatted date-time string (e.g., "17/02/2026, 10:30" for en-GB short).
 */
export function formatDateTime(
  date: Date | string,
  locale: string,
  format: DateFormatPreset = 'short',
): string {
  const parsed = parseDate(date);
  if (!parsed) return '';

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  if (format === 'long') {
    timeOptions.second = '2-digit';
  }

  const mergedOptions = {
    ...DATE_PRESETS[format],
    ...timeOptions,
    timeZone: 'UTC' as const,
  };
  return getDateFormat(locale, mergedOptions).format(parsed);
}
