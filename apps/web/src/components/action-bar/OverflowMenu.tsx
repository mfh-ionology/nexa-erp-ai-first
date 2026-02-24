import { useState, useMemo, useCallback } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ConfirmationDialog } from './confirmation-dialog';
import type { ActionDefinition, OverflowAction, OverflowSection } from './types';

/**
 * Resolves platform-agnostic shortcut tokens (e.g., 'Mod+P') to platform-specific
 * display strings ('⌘P' on macOS, 'Ctrl+P' elsewhere).
 */
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function resolveShortcutHint(hint: string): string {
  return hint.replace(/Mod\+/g, isMac ? '⌘' : 'Ctrl+');
}

/** Ordered sections — determines the rendering order of groups in the menu */
const SECTION_ORDER: OverflowSection[] = [
  'document',
  'status',
  'record',
  'ai',
  'history',
];

/** Maps section identifiers to i18n label keys */
const SECTION_LABEL_KEYS: Record<OverflowSection, string> = {
  document: 'actionBar.section.document',
  status: 'actionBar.section.status',
  record: 'actionBar.section.record',
  ai: 'actionBar.section.ai',
  history: 'actionBar.section.history',
};

export interface OverflowMenuProps {
  /** Overflow actions grouped by section */
  actions: OverflowAction[];
  /** Entity display name for confirmation dialogs */
  entityName: string;
  /** Optional: persistent tool actions moved here on mobile */
  mobileToolActions?: ActionDefinition[];
  /** Optional tabIndex for the trigger button (for roving tabindex in parent toolbar) */
  triggerTabIndex?: number;
}

/** State for the pending confirmation dialog */
interface ConfirmationState {
  action: OverflowAction;
  titleKey: string;
  descriptionKey: string;
}

export function OverflowMenu({
  actions,
  entityName,
  mobileToolActions,
  triggerTabIndex,
}: OverflowMenuProps) {
  const { t } = useI18n();
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  // Group actions by section
  const groupedActions = useMemo(() => {
    const groups = new Map<OverflowSection, OverflowAction[]>();
    for (const action of actions) {
      const existing = groups.get(action.section);
      if (existing) {
        existing.push(action);
      } else {
        groups.set(action.section, [action]);
      }
    }
    return groups;
  }, [actions]);

  // Collect the sections that have actions, in order
  const visibleSections = useMemo(
    () => SECTION_ORDER.filter((s) => groupedActions.has(s)),
    [groupedActions],
  );

  const handleItemClick = useCallback(
    (action: OverflowAction) => {
      if (action.requiresConfirmation) {
        setConfirmation({
          action,
          titleKey: action.confirmTitleKey ?? 'actionBar.confirm.deleteTitle',
          descriptionKey:
            action.confirmDescriptionKey ?? 'actionBar.confirm.deleteDescription',
        });
      } else {
        action.onAction();
      }
    },
    [],
  );

  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!confirmation) return;
    try {
      setIsConfirming(true);
      await confirmation.action.onAction();
    } finally {
      setIsConfirming(false);
      setConfirmation(null);
    }
  }, [confirmation]);

  const handleConfirmOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setConfirmation(null);
      }
    },
    [],
  );

  const hasMobileTools = mobileToolActions && mobileToolActions.length > 0;
  const hasAnyContent = visibleSections.length > 0 || hasMobileTools;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('actionBar.moreActions')}
            tabIndex={triggerTabIndex}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Mobile persistent tools section (Attachments/Links) */}
          {hasMobileTools && (
            <>
              <DropdownMenuGroup>
                {mobileToolActions.map((tool) => (
                  <DropdownMenuItem
                    key={tool.key}
                    onSelect={() => tool.onAction()}
                    disabled={tool.isLoading}
                  >
                    {tool.isLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : tool.icon ? (
                      <tool.icon />
                    ) : null}
                    {t(tool.labelKey)}
                    {tool.badgeCount != null && tool.badgeCount > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {tool.badgeCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {hasAnyContent && visibleSections.length > 0 && (
                <DropdownMenuSeparator />
              )}
            </>
          )}

          {/* Overflow sections in defined order */}
          {visibleSections.map((section, sectionIndex) => {
            const sectionActions = groupedActions.get(section)!;
            const isLastSection = sectionIndex === visibleSections.length - 1;

            return (
              <div key={section}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {t(SECTION_LABEL_KEYS[section])}
                  </DropdownMenuLabel>
                  {sectionActions.map((action) => (
                    <DropdownMenuItem
                      key={action.key}
                      variant={action.variant === 'destructive' ? 'destructive' : 'default'}
                      onSelect={() => handleItemClick(action)}
                      disabled={action.isLoading}
                    >
                      {action.isLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : action.icon ? (
                        <action.icon />
                      ) : null}
                      {t(action.labelKey)}
                      {action.shortcutHint && (
                        <DropdownMenuShortcut>
                          {resolveShortcutHint(action.shortcutHint)}
                        </DropdownMenuShortcut>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                {!isLastSection && <DropdownMenuSeparator />}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation dialog for destructive actions — uses shared ConfirmationDialog (Task 4) */}
      {confirmation && (
        <ConfirmationDialog
          open
          onOpenChange={handleConfirmOpenChange}
          titleKey={confirmation.titleKey}
          descriptionKey={confirmation.descriptionKey}
          entityName={entityName}
          onConfirm={handleConfirm}
          isLoading={isConfirming}
          variant={
            confirmation.action.variant === 'destructive'
              ? 'destructive'
              : 'default'
          }
        />
      )}
    </>
  );
}
