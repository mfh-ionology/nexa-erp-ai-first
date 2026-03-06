/* eslint-disable i18next/no-literal-string */
/**
 * Variable Autocomplete — popover triggered when user types `{{` in a prompt textarea.
 *
 * Shows available AI variables grouped by source type (System, DB Fields, Page Fields, etc.)
 * with keyboard navigation (Arrow keys, Enter to select, Escape to dismiss).
 *
 * AC-5c: variable autocomplete triggered on `{{`, showing all available variables
 * grouped by source type.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VariableItem {
  variableName: string;
  displayName: string;
  sourceType: string;
}

/** Stable ID for the listbox container (used for aria-controls on the textarea) */
export const VARIABLE_LISTBOX_ID = 'variable-autocomplete-listbox';

export interface VariableAutocompleteHandle {
  /** Notify the autocomplete that the user typed `{{` at the given textarea position */
  open: (cursorRect: DOMRect) => void;
  /** Close the autocomplete dropdown */
  close: () => void;
  /** Whether the autocomplete is currently visible */
  isOpen: boolean;
  /** ID of the currently active option (for aria-activedescendant) */
  activeDescendantId: string | undefined;
  /** Handle keyboard events — returns true if the event was consumed */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

interface VariableAutocompleteProps {
  /** Called when a variable is selected — inserts the variable name at cursor */
  onSelect: (variableName: string) => void;
  /** Filter text typed after `{{` to narrow results */
  filter?: string;
  /** Called when the autocomplete opens or closes */
  onOpenChange?: (open: boolean) => void;
}

// ─── Source type styling ─────────────────────────────────────────────────────

const SOURCE_TYPE_STYLES: Record<string, string> = {
  system: 'bg-blue-50 text-blue-700 border-blue-200',
  db_field: 'bg-green-50 text-green-700 border-green-200',
  page_field: 'bg-amber-50 text-amber-700 border-amber-200',
  constant: 'bg-gray-50 text-gray-700 border-gray-200',
  expression: 'bg-purple-50 text-purple-700 border-purple-200',
  custom: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    system: 'System',
    db_field: 'DB Fields',
    page_field: 'Page Fields',
    constant: 'Constants',
    expression: 'Expressions',
    custom: 'Custom',
  };
  return labels[sourceType] ?? sourceType;
}

// ─── Hook to fetch variables ────────────────────────────────────────────────

function useAiVariables() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: [...queryKeys.aiAdmin.all, 'variables'],
    queryFn: async () => {
      const result = await apiGet<VariableItem[]>('/ai/variables');
      return result.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VariableAutocomplete = forwardRef<
  VariableAutocompleteHandle,
  VariableAutocompleteProps
>(function VariableAutocomplete({ onSelect, filter = '', onOpenChange }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: rawVariables } = useAiVariables();
  const variables = Array.isArray(rawVariables) ? rawVariables : [];

  // Filter + group variables
  const filteredVariables = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    return variables.filter(
      (v) =>
        v.variableName.toLowerCase().includes(lowerFilter) ||
        v.displayName.toLowerCase().includes(lowerFilter),
    );
  }, [variables, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, VariableItem[]> = {};
    for (const v of filteredVariables) {
      const key = v.sourceType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    }
    return groups;
  }, [filteredVariables]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => filteredVariables, [filteredVariables]);

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current || !isOpen) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  // Compute the active descendant ID for ARIA
  const activeDescendantId =
    isOpen && flatList[activeIndex]
      ? `variable-option-${flatList[activeIndex].variableName}`
      : undefined;

  const handleSelect = useCallback(
    (variableName: string) => {
      onSelect(variableName);
      setIsOpen(false);
      onOpenChange?.(false);
    },
    [onSelect, onOpenChange],
  );

  // Imperative handle for parent textarea
  useImperativeHandle(
    ref,
    () => ({
      open: (cursorRect: DOMRect) => {
        setPosition({ top: cursorRect.bottom + 4, left: cursorRect.left });
        setIsOpen(true);
        setActiveIndex(0);
        onOpenChange?.(true);
      },
      close: () => {
        setIsOpen(false);
        onOpenChange?.(false);
      },
      isOpen,
      activeDescendantId,
      handleKeyDown: (e: React.KeyboardEvent): boolean => {
        if (!isOpen) return false;
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, flatList.length - 1));
            return true;
          case 'ArrowUp':
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
            return true;
          case 'Enter':
            e.preventDefault();
            if (flatList[activeIndex]) {
              handleSelect(flatList[activeIndex].variableName);
            }
            return true;
          case 'Escape':
            e.preventDefault();
            setIsOpen(false);
            onOpenChange?.(false);
            return true;
          default:
            return false;
        }
      },
    }),
    [isOpen, activeDescendantId, flatList, activeIndex, handleSelect, onOpenChange],
  );

  if (!isOpen) return null;

  if (flatList.length === 0) {
    return (
      <div
        id={VARIABLE_LISTBOX_ID}
        className="fixed z-50 w-72 rounded-lg border bg-popover shadow-lg"
        style={{ top: position.top, left: position.left }}
        role="listbox"
        aria-label="Variable autocomplete"
      >
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matching variables</p>
      </div>
    );
  }

  let flatIndex = 0;

  return (
    <div
      id={VARIABLE_LISTBOX_ID}
      className="fixed z-50 max-h-64 w-72 overflow-y-auto rounded-lg border bg-popover shadow-lg"
      style={{ top: position.top, left: position.left }}
      ref={listRef}
      role="listbox"
      aria-label="Variable autocomplete"
    >
      {Object.entries(grouped).map(([sourceType, items]) => (
        <div key={sourceType}>
          <div className="sticky top-0 bg-muted/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            {getSourceTypeLabel(sourceType)}
          </div>
          {items.map((item) => {
            const currentFlatIndex = flatIndex++;
            const isActive = currentFlatIndex === activeIndex;
            return (
              <button
                key={item.variableName}
                id={`variable-option-${item.variableName}`}
                type="button"
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  isActive ? 'bg-[#f5f3ff] text-[#7c3aed]' : 'hover:bg-muted/50',
                )}
                onClick={() => handleSelect(item.variableName)}
                onMouseEnter={() => setActiveIndex(currentFlatIndex)}
                tabIndex={-1}
              >
                <span className="font-mono text-xs">{item.variableName}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {item.displayName}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'shrink-0 text-[10px] px-1.5 py-0',
                    SOURCE_TYPE_STYLES[item.sourceType] ?? SOURCE_TYPE_STYLES.custom,
                  )}
                >
                  {getSourceTypeLabel(item.sourceType)}
                </Badge>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
