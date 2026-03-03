import i18next, { type i18n as I18nInstance, type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { buildInitOptions } from './config.js';

// Bundled locale files — no HTTP backend for MVP (English-only)
import commonEn from '../locales/en/common.json';
import validationEn from '../locales/en/validation.json';
import navigationEn from '../locales/en/navigation.json';
import errorsEn from '../locales/en/errors.json';
import systemEn from '../locales/en/system.json';
import aiEn from '../locales/en/ai.json';
import notificationsEn from '../locales/en/notifications.json';

/**
 * Pre-configured i18next singleton with:
 * - `initReactI18next` plugin for React integration
 * - Bundled English resource bundles
 * - Shared init options from `buildInitOptions()`
 */
const i18n: I18nInstance = i18next.createInstance();

/** Resolves when the singleton has finished initialising. Await before using `i18n`. */
export const i18nReady: Promise<TFunction> = i18n.use(initReactI18next).init(
  buildInitOptions({
    resources: {
      en: {
        common: commonEn,
        validation: validationEn,
        navigation: navigationEn,
        errors: errorsEn,
        system: systemEn,
        ai: aiEn,
        notifications: notificationsEn,
      },
    },
    react: {
      useSuspense: true,
    },
  }),
);

export { i18n };
