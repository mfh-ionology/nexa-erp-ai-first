import { create } from 'zustand';

export type SidebarMode = 'expanded' | 'collapsed' | 'hidden';

export interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
  mode: SidebarMode;
  isHoverExpanded: boolean;
  activeModule: string | null;
  expandedGroups: string[];

  // Actions
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
  setMode: (mode: SidebarMode) => void;
  setHoverExpanded: (expanded: boolean) => void;
  setActiveModule: (module: string) => void;
  toggleGroup: (group: string) => void;
}

export const useSidebarStore = create<SidebarState>()((set) => ({
  isOpen: true,
  isCollapsed: false,
  mode: 'expanded' as SidebarMode,
  isHoverExpanded: false,
  activeModule: null,
  expandedGroups: [],

  toggle: () =>
    set((s) => {
      if (s.mode === 'hidden') {
        // Mobile: toggle drawer open/close
        return { isOpen: !s.isOpen };
      }
      // Desktop/Tablet: toggle collapse state
      return { isCollapsed: !s.isCollapsed, mode: s.isCollapsed ? 'expanded' : 'collapsed' };
    }),

  collapse: () => set({ isCollapsed: true, mode: 'collapsed' }),

  expand: () => set({ isCollapsed: false, mode: 'expanded' }),

  setMode: (mode) =>
    set(() => {
      switch (mode) {
        case 'expanded':
          return { mode, isCollapsed: false, isOpen: true, isHoverExpanded: false };
        case 'collapsed':
          return { mode, isCollapsed: true, isOpen: true, isHoverExpanded: false };
        case 'hidden':
          return { mode, isOpen: false, isHoverExpanded: false };
      }
    }),

  setHoverExpanded: (expanded) => set({ isHoverExpanded: expanded }),

  setActiveModule: (module) => set({ activeModule: module }),

  toggleGroup: (group) =>
    set((s) => ({
      expandedGroups: s.expandedGroups.includes(group)
        ? s.expandedGroups.filter((g) => g !== group)
        : [...s.expandedGroups, group],
    })),
}));
