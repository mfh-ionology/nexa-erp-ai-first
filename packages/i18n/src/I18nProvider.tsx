import { type ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

import { resolveLocale } from './config.js';
import { i18n } from './i18n-instance.js';

export interface I18nProviderProps {
  children: ReactNode;
  /** User-level locale preference (highest priority). */
  userLocale?: string;
  /** Company-level default locale (fallback when userLocale is absent). */
  companyLocale?: string;
}

/**
 * React provider that wraps children with the i18next context.
 *
 * Accepts optional `userLocale` and `companyLocale` props.
 * On mount and when props change, resolves the locale via the
 * fallback chain and calls `i18n.changeLanguage()`.
 */
export function I18nProvider({
  children,
  userLocale,
  companyLocale,
}: I18nProviderProps) {
  useEffect(() => {
    const locale = resolveLocale(userLocale, companyLocale);
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [userLocale, companyLocale]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dual @types/react (v18 RN + v19 web) in pnpm store
  return <I18nextProvider i18n={i18n}>{children as any}</I18nextProvider>;
}
