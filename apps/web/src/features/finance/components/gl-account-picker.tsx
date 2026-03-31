/* eslint-disable i18next/no-literal-string */
/**
 * GL Account Picker — combobox-style account selector.
 *
 * Uses Popover + Command pattern from Shadcn UI.
 * Fetches accounts via useGlAccountSearch with debounced search.
 */

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

import { useGlAccountSearch } from '../hooks/use-gl-account-search';
import type { AccountListItem } from '../types';

interface GlAccountPickerProps {
  value: string | null;
  onChange: (accountId: string | null, account: AccountListItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function GlAccountPicker({
  value,
  onChange,
  placeholder = 'Select account...',
  disabled = false,
  className,
}: GlAccountPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: accounts = [], isLoading } = useGlAccountSearch({
    search: debouncedSearch || undefined,
    isActive: true,
    limit: 30,
  });

  // Find the selected account label
  const selectedAccount = accounts.find((a) => a.id === value);
  const displayLabel = selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{displayLabel ?? placeholder}</span>
          <div className="flex items-center gap-1">
            {value && (
              <X
                className="size-3.5 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null, null);
                }}
              />
            )}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search accounts..." value={search} onValueChange={setSearch} />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <CommandEmpty>No accounts found.</CommandEmpty>
                <CommandGroup>
                  {accounts.map((account) => (
                    <CommandItem
                      key={account.id}
                      value={account.id}
                      onSelect={() => {
                        onChange(
                          account.id === value ? null : account.id,
                          account.id === value ? null : account,
                        );
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4',
                          value === account.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {account.code}
                      </span>
                      <span className="truncate">{account.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {account.accountType}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
