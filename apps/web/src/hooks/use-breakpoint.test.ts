import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useSidebarStore } from '@/stores/sidebar-store';

import { useBreakpoint, usePrefersReducedMotion } from './use-breakpoint';

// --- matchMedia helpers ---

type MediaQueryCallback = (e: { matches: boolean }) => void;

const listeners = new Map<string, Set<MediaQueryCallback>>();

function createMatchMediaMock(matchesMap: Record<string, boolean>) {
  return vi.fn().mockImplementation((query: string) => {
    const queryListeners = listeners.get(query) ?? new Set();
    listeners.set(query, queryListeners);

    return {
      matches: matchesMap[query] ?? false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_: string, cb: MediaQueryCallback) => {
        queryListeners.add(cb);
      }),
      removeEventListener: vi.fn((_: string, cb: MediaQueryCallback) => {
        queryListeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    };
  });
}

function setBreakpoint(breakpoint: 'desktop' | 'tablet' | 'phone') {
  const matchesMap: Record<string, boolean> = {
    '(min-width: 1024px)': breakpoint === 'desktop',
    '(min-width: 768px)': breakpoint === 'desktop' || breakpoint === 'tablet',
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMediaMock(matchesMap),
  });
}

describe('useBreakpoint', () => {
  beforeEach(() => {
    listeners.clear();
    useSidebarStore.setState({
      isOpen: true,
      isCollapsed: false,
      mode: 'expanded',
      isHoverExpanded: false,
      activeModule: null,
      expandedGroups: [],
    });
  });

  it('returns "desktop" when viewport >= 1024px', () => {
    setBreakpoint('desktop');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('returns "tablet" when viewport is 768-1023px', () => {
    setBreakpoint('tablet');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it('returns "phone" when viewport < 768px', () => {
    setBreakpoint('phone');
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('phone');
  });

  it('sets sidebar to expanded mode on desktop', () => {
    setBreakpoint('desktop');
    renderHook(() => useBreakpoint());

    expect(useSidebarStore.getState().mode).toBe('expanded');
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it('sets sidebar to collapsed mode on tablet', () => {
    setBreakpoint('tablet');
    renderHook(() => useBreakpoint());

    expect(useSidebarStore.getState().mode).toBe('collapsed');
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
  });

  it('sets sidebar to hidden mode on phone', () => {
    setBreakpoint('phone');
    renderHook(() => useBreakpoint());

    expect(useSidebarStore.getState().mode).toBe('hidden');
    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});

describe('usePrefersReducedMotion', () => {
  it('returns false when prefers-reduced-motion is not set', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion is set', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });
});
