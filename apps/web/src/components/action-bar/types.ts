import type { LucideIcon } from 'lucide-react';

/** Overflow menu section identifiers — ordered as they appear in the menu */
export type OverflowSection =
  | 'document'
  | 'status'
  | 'record'
  | 'ai'
  | 'history';

/** Action variant determines button styling */
export type ActionVariant = 'default' | 'destructive' | 'ghost' | 'outline';

/** Single action definition */
export interface ActionDefinition {
  /** Unique action key (e.g., 'approve', 'void', 'print') */
  key: string;
  /** i18n translation key for the action label */
  labelKey: string;
  /** Optional Lucide icon component */
  icon?: LucideIcon;
  /** Button variant */
  variant?: ActionVariant;
  /** Callback when action is triggered. May return a Promise for async operations
   *  (e.g., API calls). The confirmation dialog stays open until the Promise resolves. */
  onAction: () => void | Promise<void>;
  /** Whether this action requires a confirmation dialog */
  requiresConfirmation?: boolean;
  /** i18n key for confirmation dialog title */
  confirmTitleKey?: string;
  /** i18n key for confirmation dialog description (receives {{ entityName }}) */
  confirmDescriptionKey?: string;
  /** Keyboard shortcut hint string (e.g., '⌘S', '⌘P') */
  shortcutHint?: string;
  /** Whether the action is currently loading/processing */
  isLoading?: boolean;
  /** Optional badge count (e.g., attachment/link count on mobile overflow items) */
  badgeCount?: number;
  /** Permission check: resource code (e.g., 'finance.invoices.detail') */
  permissionResource?: string;
  /** Permission check: required action flag */
  permissionAction?: 'canAccess' | 'canNew' | 'canView' | 'canEdit' | 'canDelete';
}

/** Primary action — appears in the primary zone (max 2) */
export interface PrimaryAction extends ActionDefinition {
  /** Whether this is the main primary action (gets primary styling) */
  isPrimary?: boolean;
}

/** Overflow action — appears in a grouped section of the overflow menu */
export interface OverflowAction extends ActionDefinition {
  /** Which overflow section this action belongs to */
  section: OverflowSection;
}

/** Status-to-actions mapping for an entity type */
export interface EntityActionConfig {
  /** Entity type identifier (e.g., 'customerInvoice', 'salesOrder') */
  entityType: string;
  /** Map of status → available actions */
  statusActions: Record<string, StatusActionSet>;
  /** Actions available regardless of status (e.g., AI Explain, View Audit Log) */
  globalActions?: OverflowAction[];
}

/** Actions available for a specific entity status */
export interface StatusActionSet {
  /** Primary actions for this status (max 2) */
  primary: PrimaryAction[];
  /** Overflow actions for this status — grouped by section */
  overflow: OverflowAction[];
}

/** Props for the ActionBar component */
export interface ActionBarProps {
  /** Entity type identifier */
  entityType: string;
  /** Current entity status */
  status: string;
  /** Resource code for component-level permission gating (e.g., 'sales.orders.detail').
   *  When provided, actions are filtered by the user's permission flags for this resource
   *  (canNew, canEdit, canDelete) in addition to per-action permissionResource checks.
   *  When omitted, only per-action permission checks apply (backward compatible). */
  resourceCode?: string;
  /** Entity display name (shown in confirmation dialogs) */
  entityName: string;
  /** Number of attachments (displayed as badge count) */
  attachmentCount?: number;
  /** Number of record links (displayed as badge count) */
  linkCount?: number;
  /** Callback when Attachments button is clicked */
  onAttachmentsClick?: () => void;
  /** Callback when Links button is clicked */
  onLinksClick?: () => void;
  /** Override action config — allows callers to provide custom actions
   *  instead of relying on the default entity action config registry */
  actionConfig?: StatusActionSet;
  /** Additional global actions (AI, History) to merge with defaults */
  additionalActions?: OverflowAction[];
  /** Whether to show persistent tools (Attachments/Links) — default true */
  showPersistentTools?: boolean;
  /** Whether to include global actions (AI, History) in the overflow menu — default true */
  showGlobalActions?: boolean;
}
