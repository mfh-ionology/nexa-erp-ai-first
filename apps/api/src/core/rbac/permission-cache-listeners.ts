import { prisma } from '@nexa/db';

import type { EventBus } from '../events/event-bus.js';
import type { EventHandler } from '../events/event-bus.types.js';
import { permissionService } from './permission.service.js';

// ---------------------------------------------------------------------------
// Permission cache invalidation event listeners (AC7, AC8)
// ---------------------------------------------------------------------------

let registered = false;
let registeredBus: EventBus | null = null;

// Store handler references so reset can use off() instead of removeAllListeners(),
// which would destructively remove ALL subscribers for those events.
let onGroupUpdated: EventHandler<'accessGroup.updated'> | null = null;
let onGroupDeleted: EventHandler<'accessGroup.deleted'> | null = null;
let onGroupsAssigned: EventHandler<'user.accessGroups.assigned'> | null = null;

/**
 * Registers event listeners on the EventBus that invalidate the permission
 * cache when access group or user assignment changes occur.
 *
 * Idempotent — safe to call multiple times (only registers once).
 * Should be called once during app bootstrap.
 */
export function registerPermissionCacheListeners(eventBus: EventBus): void {
  if (registered) return;
  registered = true;
  registeredBus = eventBus;

  // AC7 — accessGroup.updated → invalidate all users in the group
  onGroupUpdated = (event) => {
    permissionService.invalidateGroup(prisma, event.groupId, event.companyId).catch((err: unknown) => {
      console.error('[permission-cache] Failed to invalidate group cache on update:', err);
    });
  };
  eventBus.on('accessGroup.updated', onGroupUpdated);

  // AC7 — accessGroup.deleted → invalidate all users in the group
  onGroupDeleted = (event) => {
    permissionService.invalidateGroup(prisma, event.groupId, event.companyId).catch((err: unknown) => {
      console.error('[permission-cache] Failed to invalidate group cache on delete:', err);
    });
  };
  eventBus.on('accessGroup.deleted', onGroupDeleted);

  // AC8 — user.accessGroups.assigned → invalidate specific user
  onGroupsAssigned = (event) => {
    permissionService.invalidateUser(event.userId, event.companyId);
  };
  eventBus.on('user.accessGroups.assigned', onGroupsAssigned);
}

/**
 * Resets the registration flag and removes only this module's handlers.
 * For testing only.
 */
export function resetPermissionCacheListeners(): void {
  registered = false;
  if (registeredBus) {
    if (onGroupUpdated) registeredBus.off('accessGroup.updated', onGroupUpdated);
    if (onGroupDeleted) registeredBus.off('accessGroup.deleted', onGroupDeleted);
    if (onGroupsAssigned) registeredBus.off('user.accessGroups.assigned', onGroupsAssigned);
    registeredBus = null;
  }
  onGroupUpdated = null;
  onGroupDeleted = null;
  onGroupsAssigned = null;
}
