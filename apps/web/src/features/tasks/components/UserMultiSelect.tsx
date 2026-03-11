/**
 * UserMultiSelect — Combobox for selecting multiple users.
 *
 * Uses Shadcn Command (cmdk) in a Popover for searching users via the
 * existing GET /system/users endpoint. Selected users are shown as
 * removable chips above the search input.
 *
 * Follows the AccessGroupCombobox pattern from E6.8.
 */

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiGet, buildQueryString } from '@/lib/api-client';

// Lightweight user shape for search results
interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface UserMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function UserMultiSelect({ value, onChange, disabled }: UserMultiSelectProps) {
  const { t } = useI18n();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sync selectedUsers when the parent resets value (e.g. form reset).
  // Uses the setter's callback form to avoid needing selectedUsers in deps.
  useEffect(() => {
    if (value.length === 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers((prev) => prev.filter((u) => value.includes(u.id)));
    }
  }, [value]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users when search changes
  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      setIsLoading(true);
      try {
        const params: Record<string, unknown> = { limit: 20 };
        if (debouncedSearch) params.search = debouncedSearch;
        const qs = buildQueryString(params);
        const result = await apiGet<UserSearchResult[]>(`/system/users${qs}`);
        if (!cancelled) {
          setUsers(result.data);
        }
      } catch {
        // Silently fail — user will see empty list
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (open) {
      void fetchUsers();
    }

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, open]);

  // Filter out already-selected users
  const selectedSet = useMemo(() => new Set(value), [value]);

  const availableUsers = useMemo(
    () => users.filter((u) => !selectedSet.has(u.id)),
    [users, selectedSet],
  );

  // Handle selecting a user
  const handleSelect = useCallback(
    (user: UserSearchResult) => {
      setSelectedUsers((prev) => [...prev, user]);
      onChange([...value, user.id]);
      setSearch('');
    },
    [onChange, value],
  );

  // Handle removing a user
  const handleRemove = useCallback(
    (userId: string) => {
      setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
      onChange(value.filter((id) => id !== userId));
    },
    [onChange, value],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* Selected user chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 rounded-full bg-[#ede9fe] px-2.5 py-1 text-xs font-medium text-[#5b21b6]"
            >
              {user.firstName} {user.lastName}
              <button
                type="button"
                onClick={() => handleRemove(user.id)}
                className="ml-0.5 hover:text-[#ef4444]"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground outline-none focus:ring-2 focus:ring-[#7c3aed]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('tasks.create.assigneesPlaceholder', 'Search users...')}
          </button>
        </PopoverTrigger>
        <PopoverContent
          id={listId}
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t('tasks.create.assigneesPlaceholder', 'Search users...')}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading
                  ? t('common.loading', 'Loading...')
                  : t('tasks.create.noUsersFound', 'No users found')}
              </CommandEmpty>
              <CommandGroup>
                {availableUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleSelect(user)}
                    className="min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ede9fe] text-[10px] font-semibold text-[#5b21b6]">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </div>
                      <div>
                        <span className="text-sm">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
