import { useCallback, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { useLovSearch } from '../hooks/use-lov';
import type { LovStaticValue } from '../types';

interface MultiSelectFilterProps {
  fieldId: string;
  lovType: 'STATIC' | 'GLOBAL' | 'VIEW_SPECIFIC';
  lovScope: string | null;
  lovSearchMin: number;
  lovStaticValues: LovStaticValue[] | null;
  lovData: Record<string, LovStaticValue[]>;
  selected: string[];
  onSelectionChange: (values: string[]) => void;
}

export function MultiSelectFilter({
  fieldId,
  lovType,
  lovScope,
  lovSearchMin,
  lovStaticValues,
  lovData,
  selected,
  onSelectionChange,
}: MultiSelectFilterProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const useServerSearch = lovSearchMin > 0 && lovScope;
  const { searchResults, searchTerm, setSearchTerm, isSearching } = useLovSearch(
    fieldId,
    lovScope ?? '',
    lovSearchMin,
  );

  // Resolve available options based on lovType
  const baseOptions = useMemo((): LovStaticValue[] => {
    if (lovType === 'STATIC' && lovStaticValues) {
      return lovStaticValues;
    }
    return lovData[fieldId] ?? [];
  }, [lovType, lovStaticValues, lovData, fieldId]);

  // When using server search, merge base options with search results
  const displayOptions = useMemo((): LovStaticValue[] => {
    if (!useServerSearch) return baseOptions;
    if (searchTerm.length < lovSearchMin) return baseOptions;
    return searchResults;
  }, [useServerSearch, baseOptions, searchTerm, lovSearchMin, searchResults]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const handleToggle = useCallback(
    (value: string) => {
      const next = selectedSet.has(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value];
      onSelectionChange(next);
    },
    [selected, selectedSet, onSelectionChange],
  );

  const handleSelectAll = useCallback(() => {
    onSelectionChange(displayOptions.map((o) => o.value));
  }, [displayOptions, onSelectionChange]);

  const handleClear = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Trigger label
  const triggerLabel =
    selected.length === 0
      ? t('views.allValues')
      : t('views.filterCount', { count: selected.length });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-8 min-w-[120px] justify-between text-xs font-normal"
        >
          <span className="truncate">{triggerLabel}</span>
          {selected.length > 0 && (
            <Badge className="ml-1 size-5 shrink-0 rounded-full p-0 text-[10px] leading-none">
              {selected.length}
            </Badge>
          )}
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[220px] rounded-lg p-0 shadow-md" align="start">
        <Command shouldFilter={!useServerSearch}>
          <CommandInput
            placeholder={t('views.searchItems')}
            value={useServerSearch ? searchTerm : undefined}
            onValueChange={useServerSearch ? setSearchTerm : undefined}
          />
          <CommandList>
            {isSearching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isSearching && <CommandEmpty>{t('noResults')}</CommandEmpty>}
            {!isSearching && (
              <CommandGroup>
                {displayOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      handleToggle(option.value);
                    }}
                    className="gap-2"
                  >
                    <Checkbox
                      checked={selectedSet.has(option.value)}
                      className="pointer-events-none"
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-sm">{option.label}</span>
                    {selectedSet.has(option.value) && (
                      <Check className="size-3 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleSelectAll}
            >
              {t('views.selectAll')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleClear}
            >
              {t('views.clearSelection')}
            </Button>
          </div>

          {/* Item count */}
          <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            {t('itemCount', { count: displayOptions.length })}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
