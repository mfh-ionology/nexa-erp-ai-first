/**
 * Zustand store for view UI state — active view per viewKey
 * (persisted to sessionStorage).
 *
 * Created per E7-2 Task 3: shared active-view state without prop drilling.
 * Updated per E7-4: removed modal open/close state (now local to each component).
 */

import { create } from 'zustand';

interface ActiveViewEntry {
  viewId: string;
  viewName: string | null;
}

export interface ViewStoreState {
  /** Map of viewKey → active view info, persisted to sessionStorage */
  activeViews: Record<string, ActiveViewEntry>;

  // Actions
  setActiveView: (viewKey: string, viewId: string | null, viewName?: string | null) => void;
  getActiveViewId: (viewKey: string) => string | null;
}

const SESSION_KEY = 'nexa:activeViews';

function loadFromSession(): Record<string, ActiveViewEntry> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ActiveViewEntry>) : {};
  } catch {
    return {};
  }
}

function saveToSession(entries: Record<string, ActiveViewEntry>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export const useViewStore = create<ViewStoreState>((set, get) => ({
  activeViews: loadFromSession(),

  setActiveView: (viewKey, viewId, viewName = null) => {
    set((state) => {
      let next: Record<string, ActiveViewEntry>;
      if (viewId) {
        next = { ...state.activeViews, [viewKey]: { viewId, viewName } };
      } else {
        const { [viewKey]: _removed, ...rest } = state.activeViews;
        next = rest;
      }
      saveToSession(next);
      return { activeViews: next };
    });
  },

  getActiveViewId: (viewKey) => {
    return get().activeViews[viewKey]?.viewId ?? null;
  },
}));
