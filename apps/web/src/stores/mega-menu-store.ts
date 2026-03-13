import { create } from 'zustand';

interface MegaMenuState {
  isOpen: boolean;
  expandedModule: string | null;
  filterQuery: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setExpandedModule: (moduleKey: string | null) => void;
  setFilterQuery: (query: string) => void;
}

export const useMegaMenuStore = create<MegaMenuState>((set) => ({
  isOpen: false,
  expandedModule: null,
  filterQuery: '',
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, filterQuery: '' }),
  toggle: () =>
    set((s) => ({
      isOpen: !s.isOpen,
      filterQuery: s.isOpen ? '' : s.filterQuery,
    })),
  setExpandedModule: (moduleKey) => set({ expandedModule: moduleKey }),
  setFilterQuery: (query) => set({ filterQuery: query }),
}));
