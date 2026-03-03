/* eslint-disable i18next/no-literal-string */
/**
 * Variable Autocomplete Textarea — enhanced textarea that shows a dropdown
 * when the user types `{{`, letting them insert variable references.
 *
 * AC-6: Variable autocomplete in step goal text, triggered on `{{`, showing
 * system variables, previous step outputs, and constants.
 *
 * Groups:
 *  - System: {{today}}, {{currentUser.name}}, {{company.name}}, {{company.baseCurrency}}
 *  - Previous Steps: {{step1.output.*}}, {{step2.output.*}} — dynamic from current step list
 *  - API Variables: from GET /ai/variables endpoint (grouped by sourceType)
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { useAiVariables } from '../../api/use-ai-variables';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VariableItem {
  variableName: string;
  displayName: string;
  group: string;
}

export interface VariableAutocompleteTextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange'
> {
  /** Current value (controlled) */
  value: string;
  /** Change handler (controlled) */
  onChange: (value: string) => void;
  /** Current step index (0-based) — used to compute available previous step refs */
  stepIndex: number;
  /** Total step count — used for display context */
  stepCount: number;
}

// ─── Group styling ──────────────────────────────────────────────────────────

const GROUP_STYLES: Record<string, string> = {
  System: 'bg-blue-50 text-blue-700 border-blue-200',
  'Previous Steps': 'bg-purple-50 text-purple-700 border-purple-200',
  constant: 'bg-gray-50 text-gray-700 border-gray-200',
  db_field: 'bg-green-50 text-green-700 border-green-200',
  expression: 'bg-amber-50 text-amber-700 border-amber-200',
  custom: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function getGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    System: 'System',
    'Previous Steps': 'Previous Steps',
    system: 'System',
    constant: 'Constants',
    db_field: 'DB Fields',
    db_query: 'DB Queries',
    page_field: 'Page Fields',
    expression: 'Expressions',
    custom: 'Custom',
  };
  return labels[group] ?? group;
}

// ─── Built-in system variables ──────────────────────────────────────────────

const SYSTEM_VARIABLES: VariableItem[] = [
  { variableName: 'today', displayName: 'Current date', group: 'System' },
  { variableName: 'currentUser.name', displayName: 'Current user name', group: 'System' },
  { variableName: 'company.name', displayName: 'Company name', group: 'System' },
  { variableName: 'company.baseCurrency', displayName: 'Base currency', group: 'System' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const VariableAutocompleteTextarea = forwardRef<
  HTMLTextAreaElement,
  VariableAutocompleteTextareaProps
>(function VariableAutocompleteTextarea(
  { value, onChange, stepIndex, stepCount, className, ...textareaProps },
  forwardedRef,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Merge forwarded ref with internal ref
  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else if (forwardedRef) {
        forwardedRef.current = el;
      }
    },
    [forwardedRef],
  );

  // Fetch API variables
  const { data: apiVariables } = useAiVariables();

  // Build dynamic previous-step variables
  const previousStepVars = useMemo<VariableItem[]>(() => {
    const vars: VariableItem[] = [];
    for (let i = 0; i < stepIndex; i++) {
      vars.push({
        variableName: `step${i + 1}.output.*`,
        displayName: `Step ${i + 1} full output`,
        group: 'Previous Steps',
      });
    }
    return vars;
  }, [stepIndex]);

  // Merge API variables into VariableItem format
  const apiVarItems = useMemo<VariableItem[]>(() => {
    if (!apiVariables) return [];
    const items: VariableItem[] = [];
    for (const [sourceType, vars] of Object.entries(apiVariables)) {
      for (const v of vars) {
        // Skip if it duplicates a system variable
        if (SYSTEM_VARIABLES.some((sv) => sv.variableName === v.variableName)) continue;
        items.push({
          variableName: v.variableName,
          displayName: v.displayName,
          group: sourceType,
        });
      }
    }
    return items;
  }, [apiVariables]);

  // Combined + filtered variable list
  const allVariables = useMemo(() => {
    return [...SYSTEM_VARIABLES, ...previousStepVars, ...apiVarItems];
  }, [previousStepVars, apiVarItems]);

  const filteredVariables = useMemo(() => {
    if (!filter) return allVariables;
    const lowerFilter = filter.toLowerCase();
    return allVariables.filter(
      (v) =>
        v.variableName.toLowerCase().includes(lowerFilter) ||
        v.displayName.toLowerCase().includes(lowerFilter),
    );
  }, [allVariables, filter]);

  // Group for display
  const grouped = useMemo(() => {
    const groups: Record<string, VariableItem[]> = {};
    for (const v of filteredVariables) {
      const g = groups[v.group] ?? (groups[v.group] = []);
      g.push(v);
    }
    return groups;
  }, [filteredVariables]);

  // Reset active index on filter change
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  // Scroll active item into view
  useEffect(() => {
    if (!dropdownRef.current || !isOpen) return;
    const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Insert a selected variable at the trigger position
  const handleSelect = useCallback(
    (variableName: string) => {
      if (triggerStart === null) return;
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Replace from `{{` trigger through current cursor with `{{variableName}}`
      const cursorPos = textarea.selectionStart;
      const before = value.slice(0, triggerStart);
      const after = value.slice(cursorPos);
      const insertion = `{{${variableName}}}`;
      const newValue = before + insertion + after;

      onChange(newValue);
      setIsOpen(false);
      setFilter('');
      setTriggerStart(null);

      // Restore cursor position after the inserted variable
      const newCursorPos = triggerStart + insertion.length;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, onChange, triggerStart],
  );

  // Detect `{{` trigger and filter text on input
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;
      onChange(newValue);

      // Look backwards from cursor for `{{`
      const textBeforeCursor = newValue.slice(0, cursorPos);
      const lastDoubleBrace = textBeforeCursor.lastIndexOf('{{');

      if (lastDoubleBrace !== -1) {
        // Check there's no `}}` between `{{` and cursor (i.e. we're inside a variable ref)
        const textAfterBrace = textBeforeCursor.slice(lastDoubleBrace + 2);
        if (!textAfterBrace.includes('}}')) {
          setTriggerStart(lastDoubleBrace);
          setFilter(textAfterBrace);
          setIsOpen(true);
          setActiveIndex(0);
          return;
        }
      }

      // No active trigger
      if (isOpen) {
        setIsOpen(false);
        setFilter('');
        setTriggerStart(null);
      }
    },
    [onChange, isOpen],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, filteredVariables.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredVariables[activeIndex]) {
            handleSelect(filteredVariables[activeIndex].variableName);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setFilter('');
          setTriggerStart(null);
          break;
        case 'Tab':
          setIsOpen(false);
          setFilter('');
          setTriggerStart(null);
          break;
      }
    },
    [isOpen, filteredVariables, activeIndex, handleSelect],
  );

  // Approximate dropdown position near the trigger line
  const dropdownStyle = useMemo(() => {
    if (triggerStart === null) return { top: '100%' };
    const textBeforeTrigger = value.slice(0, triggerStart);
    const lineCount = textBeforeTrigger.split('\n').length;
    // ~20px per line + 8px padding, capped at textarea height
    const topPx = Math.min(lineCount * 20 + 8, 200);
    return { top: `${topPx}px` };
  }, [triggerStart, value]);

  let flatIndex = 0;

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={setRefs}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        aria-autocomplete={isOpen ? 'list' : undefined}
        aria-controls={isOpen ? `variable-autocomplete-listbox-${stepIndex}` : undefined}
        aria-activedescendant={
          isOpen && filteredVariables[activeIndex]
            ? `var-opt-${stepIndex}-${filteredVariables[activeIndex].variableName}`
            : undefined
        }
        {...textareaProps}
      />

      {isOpen && (
        <div
          id={`variable-autocomplete-listbox-${stepIndex}`}
          ref={dropdownRef}
          className="absolute left-0 z-50 mt-1 max-h-64 w-80 overflow-y-auto rounded-xl border bg-popover shadow-lg"
          role="listbox"
          aria-label="Variable autocomplete"
          style={dropdownStyle}
        >
          {filteredVariables.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matching variables
            </p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="sticky top-0 bg-muted/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                  {getGroupLabel(group)}
                </div>
                {items.map((item) => {
                  const currentFlatIndex = flatIndex++;
                  const isActive = currentFlatIndex === activeIndex;
                  return (
                    <button
                      key={`${item.group}-${item.variableName}`}
                      id={`var-opt-${stepIndex}-${item.variableName}`}
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
                      <span className="font-mono text-xs">{`{{${item.variableName}}}`}</span>
                      <span className="flex-1 truncate text-xs text-muted-foreground">
                        {item.displayName}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 text-[10px] px-1.5 py-0',
                          GROUP_STYLES[item.group] ?? GROUP_STYLES.custom,
                        )}
                      >
                        {getGroupLabel(item.group)}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});
