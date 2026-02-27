/**
 * Zustand store for view UI state — modal open/close, active tab,
 * and active view per viewKey (persisted to sessionStorage).
 *
 * Created per E7-2 Task 3: shared modal/active-view state without prop drilling.
 */

import { create } from 'zustand';

export type ViewModalTab = 'views' | 'columns';
export type FilterModalTab = 'filters' | 'sort';

interface ActiveViewEntry {
  viewId: string;
  viewName: string | null;
}

export interface ViewStoreState {
  /** Map of viewKey → active view info, persisted to sessionStorage */
  activeViews: Record<string, ActiveViewEntry>;
  /** Whether the Views & Columns modal is open */
  isViewsModalOpen: boolean;
  /** Which tab is active in the modal */
  activeModalTab: ViewModalTab;
  /** Which viewKey the modal is open for */
  modalViewKey: string | null;

  /** Whether the Filter & Sort modal is open */
  isFilterModalOpen: boolean;
  /** Which tab is active in the filter modal */
  activeFilterModalTab: FilterModalTab;
  /** Which viewKey the filter modal is open for */
  filterModalViewKey: string | null;

  // Actions
  setActiveView: (viewKey: string, viewId: string | null, viewName?: string | null) => void;
  getActiveViewId: (viewKey: string) => string | null;
  openViewsModal: (viewKey: string, tab?: ViewModalTab) => void;
  closeViewsModal: () => void;
  setModalTab: (tab: ViewModalTab) => void;
  openFilterModal: (viewKey: string, tab?: FilterModalTab) => void;
  closeFilterModal: () => void;
  setFilterModalTab: (tab: FilterModalTab) => void;
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
  isViewsModalOpen: false,
  activeModalTab: 'views',
  modalViewKey: null,

  isFilterModalOpen: false,
  activeFilterModalTab: 'filters',
  filterModalViewKey: null,

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

  openViewsModal: (viewKey, tab = 'views') => {
    set({ isViewsModalOpen: true, activeModalTab: tab, modalViewKey: viewKey });
  },

  closeViewsModal: () => {
    set({ isViewsModalOpen: false, modalViewKey: null });
  },

  setModalTab: (tab) => {
    set({ activeModalTab: tab });
  },

  openFilterModal: (viewKey, tab = 'filters') => {
    set({ isFilterModalOpen: true, activeFilterModalTab: tab, filterModalViewKey: viewKey });
  },

  closeFilterModal: () => {
    set({ isFilterModalOpen: false, filterModalViewKey: null });
  },

  setFilterModalTab: (tab) => {
    set({ activeFilterModalTab: tab });
  },
}));
