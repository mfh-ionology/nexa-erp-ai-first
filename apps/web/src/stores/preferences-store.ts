import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PreferencesState {
  locale: string;
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
  dateFormat: string;

  // Actions
  setLocale: (locale: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setDensity: (density: 'comfortable' | 'compact') => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: 'en',
      theme: 'system',
      density: 'comfortable',
      dateFormat: 'dd/MM/yyyy',

      setLocale: (locale) => set({ locale }),

      setTheme: (theme) => set({ theme }),

      setDensity: (density) => set({ density }),
    }),
    {
      name: 'nexa-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        locale: state.locale,
        theme: state.theme,
        density: state.density,
        dateFormat: state.dateFormat,
      }),
    },
  ),
);
