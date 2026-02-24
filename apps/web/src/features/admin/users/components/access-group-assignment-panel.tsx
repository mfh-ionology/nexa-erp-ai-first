/**
 * Access Group Assignment Panel.
 *
 * Manages local state of assigned access groups with dirty tracking.
 * Renders each group as a removable badge with tooltip metadata.
 * Shows empty state when no groups are assigned.
 *
 * The Save button and combobox for adding groups are wired in Tasks 5 & 6.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { useI18n, useFormatDate } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { UserAccessGroupAssignment } from '../api/types';
import {
  useUserAccessGroups,
  useAssignAccessGroups,
} from '../api/use-user-access-groups';
import { AccessGroupCombobox } from './access-group-combobox';

// --- Component ---

export interface AccessGroupAssignmentPanelProps {
  userId: string;
}

export function AccessGroupAssignmentPanel({
  userId,
}: AccessGroupAssignmentPanelProps) {
  const { t } = useI18n();
  const formatDate = useFormatDate();

  // --- Fetch assigned groups ---
  const {
    data: serverGroups,
    isLoading,
    isError,
  } = useUserAccessGroups(userId);

  // --- Local state for optimistic edits ---
  const [localGroups, setLocalGroups] = useState<UserAccessGroupAssignment[]>(
    [],
  );
  const [hasInitialised, setHasInitialised] = useState(false);
  const pendingSyncRef = useRef(false);

  // Sync server data → local state only on initial load or after a successful save.
  // Background refetches (e.g. window focus) do NOT overwrite unsaved local edits.
  useEffect(() => {
    if (serverGroups && (!hasInitialised || pendingSyncRef.current)) {
      setLocalGroups(serverGroups);
      setHasInitialised(true);
      pendingSyncRef.current = false;
    }
  }, [serverGroups, hasInitialised]);

  // --- Dirty tracking ---
  const isDirty = useMemo(() => {
    if (!serverGroups || !hasInitialised) return false;
    const serverIds = new Set(serverGroups.map((g) => g.id));
    const localIds = new Set(localGroups.map((g) => g.id));
    if (serverIds.size !== localIds.size) return true;
    for (const id of serverIds) {
      if (!localIds.has(id)) return true;
    }
    return false;
  }, [serverGroups, localGroups, hasInitialised]);

  // --- Remove handler ---
  const handleRemove = useCallback((groupId: string) => {
    setLocalGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  // --- Add handler (called by combobox in Task 5) ---
  const handleAdd = useCallback((group: UserAccessGroupAssignment) => {
    setLocalGroups((prev) => {
      // Prevent duplicates
      if (prev.some((g) => g.id === group.id)) return prev;
      return [...prev, group];
    });
  }, []);

  // --- Save mutation ---
  const assignMutation = useAssignAccessGroups(userId);
  const { mutate } = assignMutation;

  const canSave = isDirty && localGroups.length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    // Allow the next server data update (from query invalidation) to sync to local state
    pendingSyncRef.current = true;
    mutate({
      accessGroupIds: localGroups.map((g) => g.id),
    });
  }, [canSave, mutate, localGroups]);

  // --- Loading state ---
  if (isLoading) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            {t('users.accessGroups.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  // --- Error state ---
  if (isError) {
    return (
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            {t('users.accessGroups.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 text-center text-muted-foreground">
          {t('users.error.loadFailed')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">
          {t('users.accessGroups.title')}
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            <AccessGroupCombobox
              assignedGroupIds={localGroups.map((g) => g.id)}
              onAdd={handleAdd}
            />
            <Button
              size="sm"
              disabled={!canSave || assignMutation.isPending}
              onClick={handleSave}
            >
              {assignMutation.isPending && (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              )}
              {t('users.accessGroups.save')}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* Empty state (AC #9 — subtask 4.4) */}
        {localGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('users.accessGroups.emptyState')}
            </p>
            {isDirty && (
              <p className="text-sm text-destructive" role="alert">
                {t('users.accessGroups.minOneRequired')}
              </p>
            )}
            <AccessGroupCombobox
              assignedGroupIds={localGroups.map((g) => g.id)}
              onAdd={handleAdd}
            />
          </div>
        ) : (
          /* Assigned group tags (AC #3 — subtask 4.3) */
          <TooltipProvider>
            <div
              className="flex flex-wrap gap-2"
              role="list"
              aria-label={t('users.accessGroups.title')}
            >
              {localGroups.map((group) => (
                <Tooltip key={group.id}>
                  <TooltipTrigger asChild>
                    <div role="listitem" className="inline-flex">
                      <Badge
                        variant="outline"
                        className="gap-1.5 py-1 pl-2.5 pr-1"
                      >
                        <span>{group.name}</span>
                        {group.isSystem && (
                          <Badge
                            variant="secondary"
                            className="ml-0.5 px-1 py-0 text-[10px]"
                          >
                            {t('accessGroups.systemBadge')}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 rounded-full hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemove(group.id)}
                          aria-label={t('users.accessGroups.removeLabel', {
                            name: group.name,
                          })}
                        >
                          <X className="size-3" />
                        </Button>
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {group.assignedBy ? (
                      <div className="space-y-1">
                        <p>
                          {t('users.accessGroups.assignedBy', {
                            name: group.assignedBy,
                          })}
                        </p>
                        <p>
                          {t('users.accessGroups.assignedAt', {
                            date: formatDate(group.assignedAt),
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="italic text-muted-foreground">
                        {t('users.accessGroups.pendingSave')}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
