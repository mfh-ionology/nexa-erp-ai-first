/**
 * Push notification categories — actionable notification definitions.
 *
 * Configures notification categories so the OS can display action buttons
 * directly on the notification (e.g., "Approve" / "Reject" for approval requests)
 * without requiring the user to open the full app.
 *
 * Must be called once during app initialisation (before any notifications arrive).
 */

import * as Notifications from 'expo-notifications';

/** Category identifier for approval request notifications. */
export const CATEGORY_APPROVAL_REQUEST = 'APPROVAL_REQUEST';

/** Action identifiers within the approval category. */
export const ACTION_APPROVE = 'APPROVE';
export const ACTION_REJECT = 'REJECT';

/**
 * Register all notification categories with the OS.
 *
 * This tells iOS / Android about the action buttons that should appear
 * on notifications tagged with specific category identifiers.
 *
 * @param approveLabel — translated "Approve" button label (from i18n)
 * @param rejectLabel — translated "Reject" button label (from i18n)
 */
export async function setupNotificationCategories(
  approveLabel: string,
  rejectLabel: string,
): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORY_APPROVAL_REQUEST, [
    {
      identifier: ACTION_APPROVE,
      buttonTitle: approveLabel,
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: ACTION_REJECT,
      buttonTitle: rejectLabel,
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
  ]);
}
