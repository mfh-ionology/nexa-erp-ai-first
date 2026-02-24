/**
 * Access Group Combobox.
 *
 * Popover + Command (cmdk) combobox for selecting access groups to assign.
 * Reuses useAccessGroups from E6.8 to fetch active groups, filters out
 * already-assigned groups client-side, and renders as a bottom Sheet on
 * phone viewports.
 *
 * Keyboard: Arrow Up/Down navigate, Enter selects, Escape closes (handled by cmdk).
 * ARIA: role="combobox", aria-expanded, aria-controls, aria-haspopup="listbox"
 *   placed on the focusable Button element per WAI-ARIA 1.2.
 */

import { useCallback, useId, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useBreakpoint } from '@/hooks/use-breakpoint';

import { useAccessGroups } from '../../access-groups/api/use-access-groups';
import type { AccessGroup } from '../../access-groups/api/types';
import type { UserAccessGroupAssignment } from '../api/types';

// --- Props ---

export interface AccessGroupComboboxProps {
  /** IDs of groups already assigned (excluded from dropdown). */
  assignedGroupIds: string[];
  /** Called when a group is selected from the dropdown. */
  onAdd: (group: UserAccessGroupAssignment) => void;
}

// --- Component ---

export function AccessGroupCombobox({
  assignedGroupIds,
  onAdd,
}: AccessGroupComboboxProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Reuse useAccessGroups from E6.8 to fetch all active groups
  const { data: accessGroupData } = useAccessGroups({ isActive: true });
  const allGroups = accessGroupData?.data ?? [];

  // Filter out already-assigned groups
  const assignedSet = useMemo(
    () => new Set(assignedGroupIds),
    [assignedGroupIds],
  );

  const availableGroups = useMemo(
    () => allGroups.filter((g) => !assignedSet.has(g.id)),
    [allGroups, assignedSet],
  );

  // Client-side type-ahead search filtering
  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return availableGroups;
    return availableGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q),
    );
  }, [availableGroups, search]);

  // Select handler: convert AccessGroup → UserAccessGroupAssignment, close popover
  const handleSelect = useCallback(
    (group: AccessGroup) => {
      const assignment: UserAccessGroupAssignment = {
        id: group.id,
        code: group.code,
        name: group.name,
        description: group.description,
        isSystem: group.isSystem,
        assignedBy: null,
        assignedAt: new Date().toISOString(),
      };
      onAdd(assignment);
      setOpen(false);
      setSearch('');
    },
    [onAdd],
  );

  // Shared Command content used by both Popover and Sheet
  const commandContent = (
    <Command shouldFilter={false}>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={t('users.accessGroups.searchPlaceholder')}
      />
      <CommandList>
        <CommandEmpty>
          {t('users.accessGroups.noGroupsAvailable')}
        </CommandEmpty>
        <CommandGroup>
          {filteredGroups.map((group) => (
            <CommandItem
              key={group.id}
              value={group.id}
              onSelect={() => handleSelect(group)}
              className="min-h-[44px]"
            >
              <span>{group.name}</span>
              {group.description && (
                <span className="ml-2 truncate text-xs text-muted-foreground">
                  {group.description}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  // Phone: full-width bottom Sheet (AC #10)
  if (breakpoint === 'phone') {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-label={t('users.accessGroups.addGroup')}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">
              {t('users.accessGroups.addGroup')}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-[60vh]"
          aria-label={t('users.accessGroups.addGroup')}
        >
          <SheetHeader>
            <SheetTitle>{t('users.accessGroups.addGroup')}</SheetTitle>
            <SheetDescription>
              {t('users.accessGroups.searchPlaceholder')}
            </SheetDescription>
          </SheetHeader>
          <div id={listId} className="flex-1 overflow-hidden">
            {commandContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop / Tablet: Popover + Command combobox
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-label={t('users.accessGroups.addGroup')}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">
            {t('users.accessGroups.addGroup')}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        className="w-[300px] p-0"
        align="end"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {commandContent}
      </PopoverContent>
    </Popover>
  );
}
