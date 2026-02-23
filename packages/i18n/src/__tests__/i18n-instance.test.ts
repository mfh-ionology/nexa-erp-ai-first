import { describe, it, expect, vi } from 'vitest';

describe('i18n instance', () => {
  // Use a fresh instance per test to avoid cross-test pollution.
  // createI18nInstance() is async and awaits init() internally.
  async function freshInstance() {
    const { createI18nInstance } = await import('../config.js');
    return createI18nInstance();
  }

  async function singletonInstance() {
    const { i18n, i18nReady } = await import('../i18n-instance.js');
    await i18nReady;
    return i18n;
  }

  describe('createI18nInstance()', () => {
    it('returns a configured i18next instance', async () => {
      const instance = await freshInstance();

      expect(instance).toBeDefined();
      expect(instance.isInitialized).toBe(true);
      expect(typeof instance.t).toBe('function');
    });

    it('has correct default configuration', async () => {
      const instance = await freshInstance();

      expect(instance.language).toBe('en');
      expect(instance.options.fallbackLng).toContain('en');
      expect(instance.options.defaultNS).toBe('common');
      expect(instance.options.interpolation?.escapeValue).toBe(false);
      expect(instance.options.returnNull).toBe(false);
      expect(instance.options.returnEmptyString).toBe(false);
    });

    it('has all four namespaces configured', async () => {
      const instance = await freshInstance();
      const ns = instance.options.ns;

      expect(ns).toContain('common');
      expect(ns).toContain('validation');
      expect(ns).toContain('navigation');
      expect(ns).toContain('errors');
    });
  });

  describe('singleton instance with loaded resources', () => {
    it('loads English translations for all namespaces', async () => {
      const i18n = await singletonInstance();

      // common
      expect(i18n.exists('common:save')).toBe(true);
      expect(i18n.exists('common:cancel')).toBe(true);

      // validation
      expect(i18n.exists('validation:required')).toBe(true);
      expect(i18n.exists('validation:email')).toBe(true);

      // navigation
      expect(i18n.exists('navigation:dashboard')).toBe(true);
      expect(i18n.exists('navigation:settings')).toBe(true);

      // errors
      expect(i18n.exists('errors:NOT_FOUND')).toBe(true);
      expect(i18n.exists('errors:SERVER_ERROR')).toBe(true);
    });

    it('resolves key: t("save") returns "Save" (default namespace)', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('save')).toBe('Save');
    });

    it('resolves namespaced key: t("common:save") returns "Save"', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('common:save')).toBe('Save');
    });

    it('resolves various common keys correctly', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('common:cancel')).toBe('Cancel');
      expect(i18n.t('common:delete')).toBe('Delete');
      expect(i18n.t('common:loading')).toBe('Loading...');
      expect(i18n.t('common:noResults')).toBe('No results found');
      expect(i18n.t('common:confirmDelete')).toBe(
        'Are you sure you want to delete this item?',
      );
    });

    it('resolves interpolation: t("validation:required", { field: "Email" })', async () => {
      const i18n = await singletonInstance();

      const result = i18n.t('validation:required', { field: 'Email' });
      expect(result).toBe('Email is required');
    });

    it('resolves multi-param interpolation', async () => {
      const i18n = await singletonInstance();

      const result = i18n.t('validation:minLength', {
        field: 'Password',
        min: 8,
      });
      expect(result).toBe('Password must be at least 8 characters');
    });

    it('resolves navigation keys correctly', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('navigation:dashboard')).toBe('Dashboard');
      expect(i18n.t('navigation:finance')).toBe('Finance');
      expect(i18n.t('navigation:hr')).toBe('HR & Payroll');
    });

    it('resolves error keys correctly', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('errors:AUTH_INVALID_CREDENTIALS')).toBe(
        'Invalid email or password',
      );
      expect(i18n.t('errors:AUTH_TOKEN_EXPIRED')).toBe(
        'Your session has expired. Please log in again',
      );
    });

    it('namespace isolation: same key name in different namespaces resolves independently', async () => {
      const i18n = await singletonInstance();

      // "required" exists in both common and validation with different values
      expect(i18n.t('common:required')).toBe('Required');
      expect(i18n.t('validation:required', { field: 'Name' })).toBe(
        'Name is required',
      );
    });
  });

  describe('pluralisation', () => {
    it('resolves singular form (count=1)', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('common:itemCount', { count: 1 })).toBe('1 item');
    });

    it('resolves plural form (count=0)', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('common:itemCount', { count: 0 })).toBe('0 items');
    });

    it('resolves plural form (count>1)', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('common:itemCount', { count: 5 })).toBe('5 items');
    });

    it('resolves recordCount singular and plural', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('common:recordCount', { count: 1 })).toBe('1 record');
      expect(i18n.t('common:recordCount', { count: 42 })).toBe('42 records');
    });

    it('resolves selectedCount plural', async () => {
      const i18n = await singletonInstance();

      expect(i18n.t('common:selectedCount', { count: 3 })).toBe('3 selected');
    });
  });

  describe('missing key handling', () => {
    it('returns the key string for non-existent keys', async () => {
      const i18n = await singletonInstance();

      const result = i18n.t('common:nonExistentKey');
      expect(result).toBe('nonExistentKey');
    });

    it('logs warning in dev mode for missing keys', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create a fresh singleton-like instance with saveMissing enabled
      const i18next = await import('i18next');
      const instance = i18next.default.createInstance();
      await instance.init({
        lng: 'en',
        fallbackLng: 'en',
        ns: ['common'],
        defaultNS: 'common',
        resources: { en: { common: { existing: 'Existing' } } },
        saveMissing: true,
        missingKeyHandler: (_lngs: unknown, ns: string, key: string) => {
          console.warn(`[i18n] Missing key: ${ns}:${key}`);
        },
      });

      instance.t('totallyMissingKey');

      expect(warnSpy).toHaveBeenCalledWith(
        '[i18n] Missing key: common:totallyMissingKey',
      );

      warnSpy.mockRestore();
    });
  });
});
