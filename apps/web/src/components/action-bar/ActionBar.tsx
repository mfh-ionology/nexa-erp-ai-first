import { useMemo, useRef, useCallback, useState } from 'react';
import { Loader2, Link2, Paperclip } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { usePermission } from '@/hooks/use-permissions';

import { getEntityActionConfig, getGlobalActions } from './action-config';
import { OverflowMenu } from './OverflowMenu';
import { useActionPermissions } from './use-action-permissions';
import type {
  ActionBarProps,
  ActionDefinition,
  OverflowAction,
  PrimaryAction,
} from './types';

const MAX_PRIMARY_ACTIONS = 2;

/**
 * ActionBar — the single consistency element across all record screens.
 *
 * Three-zone layout:
 *   1. Primary Zone (left)    — up to 2 status-driven action buttons
 *   2. Persistent Tools (mid) — Attachments + Links buttons with count badges
 *   3. Overflow Zone (right)  — grouped dropdown (⋯)
 *
 * Actions are filtered by both status (state machine) and permissions (RBAC).
 */
export function ActionBar({
  entityType,
  status,
  entityName,
  resourceCode,
  attachmentCount = 0,
  linkCount = 0,
  onAttachmentsClick,
  onLinksClick,
  actionConfig,
  additionalActions,
  showPersistentTools = true,
  showGlobalActions = true,
}: ActionBarProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const isPhone = breakpoint === 'phone';

  // --- Resolve actions for current entity + status ---
  const resolvedActions = actionConfig ?? getEntityActionConfig(entityType, status);
  const globalActions = showGlobalActions ? getGlobalActions(entityType) : [];

  // Merge global actions with any additional actions from the caller
  const allOverflowActions = useMemo<OverflowAction[]>(() => {
    const merged = [...resolvedActions.overflow, ...globalActions];
    if (additionalActions) {
      merged.push(...additionalActions);
    }
    return merged;
  }, [resolvedActions.overflow, globalActions, additionalActions]);

  // --- Permission filtering ---
  const permittedPrimary = useActionPermissions<PrimaryAction>(resolvedActions.primary);
  const permittedOverflow = useActionPermissions<OverflowAction>(allOverflowActions);

  // --- Component-level permission gate (resourceCode prop) ---
  const resourcePerms = usePermission(resourceCode ?? '');

  const resourceFilteredPrimary = useMemo(() => {
    if (!resourceCode) return permittedPrimary;
    return permittedPrimary.filter((action) => {
      if (!action.permissionAction) return true;
      return resourcePerms[action.permissionAction];
    });
  }, [resourceCode, permittedPrimary, resourcePerms]);

  const resourceFilteredOverflow = useMemo(() => {
    if (!resourceCode) return permittedOverflow;
    return permittedOverflow.filter((action) => {
      if (!action.permissionAction) return true;
      return resourcePerms[action.permissionAction];
    });
  }, [resourceCode, permittedOverflow, resourcePerms]);

  // Enforce max 2 primary actions
  const visiblePrimary = useMemo(() => {
    if (resourceFilteredPrimary.length > MAX_PRIMARY_ACTIONS) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[ActionBar] ${entityType}/${status}: ${resourceFilteredPrimary.length} primary actions configured, maximum is ${MAX_PRIMARY_ACTIONS}. Extras will be hidden.`,
        );
      }
      return resourceFilteredPrimary.slice(0, MAX_PRIMARY_ACTIONS);
    }
    return resourceFilteredPrimary;
  }, [resourceFilteredPrimary, entityType, status]);

  // --- Phone: collapse to single primary + overflow, tools move inside overflow ---
  const phonePrimary = isPhone ? visiblePrimary.slice(0, 1) : visiblePrimary;

  // Build mobile tool actions (Attachments/Links) for the overflow menu on phone
  const mobileToolActions = useMemo<ActionDefinition[] | undefined>(() => {
    if (!isPhone || !showPersistentTools) return undefined;
    const tools: ActionDefinition[] = [];
    tools.push({
      key: 'attachments',
      labelKey: 'actionBar.attachments',
      icon: Paperclip,
      badgeCount: attachmentCount,
      onAction: onAttachmentsClick ?? (() => {}),
    });
    tools.push({
      key: 'links',
      labelKey: 'actionBar.links',
      icon: Link2,
      badgeCount: linkCount,
      onAction: onLinksClick ?? (() => {}),
    });
    return tools;
  }, [isPhone, showPersistentTools, onAttachmentsClick, onLinksClick, attachmentCount, linkCount]);

  // --- Roving tabindex for WAI-ARIA toolbar pattern ---
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const handleToolbarKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
        return;
      }
      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      const buttons = Array.from(
        toolbar.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
      );
      if (buttons.length === 0) return;

      e.preventDefault();

      let nextIndex = focusIndex;
      if (e.key === 'ArrowRight') {
        nextIndex = (focusIndex + 1) % buttons.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (focusIndex - 1 + buttons.length) % buttons.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = buttons.length - 1;
      }

      setFocusIndex(nextIndex);
      buttons[nextIndex]?.focus();
    },
    [focusIndex],
  );

  // Compute tabIndex for each button: only the focused one gets tabIndex=0
  const getTabIndex = useCallback(
    (buttonIndex: number) => (buttonIndex === focusIndex ? 0 : -1),
    [focusIndex],
  );

  // Track a running index across all buttons rendered in the toolbar
  let buttonIdx = 0;

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t('actionBar.ariaLabel')}
      className="flex items-center gap-2"
      onKeyDown={handleToolbarKeyDown}
    >
      {/* --- Primary Zone --- */}
      {phonePrimary.map((action, index) => {
        const variant =
          action.variant ?? (index === 0 && action.isPrimary !== false ? 'default' : 'outline');
        const thisIdx = buttonIdx++;

        return (
          <Button
            key={action.key}
            variant={variant}
            onClick={action.onAction}
            disabled={action.isLoading}
            tabIndex={getTabIndex(thisIdx)}
          >
            {action.isLoading ? (
              <Loader2 className="animate-spin" />
            ) : action.icon ? (
              <action.icon />
            ) : null}
            {t(action.labelKey)}
          </Button>
        );
      })}

      {/* --- Persistent Tools Zone (desktop/tablet only) --- */}
      {showPersistentTools && !isPhone && (
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAttachmentsClick}
            disabled={!onAttachmentsClick}
            aria-label={t('actionBar.attachments')}
            tabIndex={!onAttachmentsClick ? undefined : getTabIndex(buttonIdx++)}
          >
            <Paperclip />
            {t('actionBar.attachments')}
            {attachmentCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {attachmentCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLinksClick}
            disabled={!onLinksClick}
            aria-label={t('actionBar.links')}
            tabIndex={!onLinksClick ? undefined : getTabIndex(buttonIdx++)}
          >
            <Link2 />
            {t('actionBar.links')}
            {linkCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {linkCount}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* --- Overflow Zone --- */}
      <OverflowMenu
        actions={resourceFilteredOverflow}
        entityName={entityName}
        mobileToolActions={mobileToolActions}
        triggerTabIndex={getTabIndex(buttonIdx++)}
      />
    </div>
  );
}
