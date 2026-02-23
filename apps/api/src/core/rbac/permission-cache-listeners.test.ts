import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {},
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
}));

const { mockPermissionService } = vi.hoisted(() => ({
  mockPermissionService: {
    invalidateGroup: vi.fn().mockResolvedValue(undefined),
    invalidateUser: vi.fn(),
  },
}));

vi.mock('./permission.service.js', () => ({
  permissionService: mockPermissionService,
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { EventBus } from '../events/event-bus.js';
import {
  registerPermissionCacheListeners,
  resetPermissionCacheListeners,
} from './permission-cache-listeners.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** Flush queueMicrotask-scheduled handlers */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('permission-cache-listeners', () => {
  let bus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPermissionCacheListeners();
    bus = new EventBus();
  });

  afterEach(() => {
    resetPermissionCacheListeners();
  });

  // =========================================================================
  // Idempotency (Issue #11)
  // =========================================================================

  it('registers listeners only once (idempotent)', async () => {
    registerPermissionCacheListeners(bus);
    registerPermissionCacheListeners(bus);

    bus.emit('accessGroup.updated', {
      groupId: 'g1',
      companyId: 'c1',
      changedBy: 'u1',
    });

    await flushMicrotasks();

    // Should only be called once, not twice
    expect(mockPermissionService.invalidateGroup).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // AC7 — accessGroup.updated → invalidate group
  // =========================================================================

  it('invalidates group cache on accessGroup.updated', async () => {
    registerPermissionCacheListeners(bus);

    bus.emit('accessGroup.updated', {
      groupId: 'group-1',
      companyId: 'company-1',
      changedBy: 'user-1',
    });

    await flushMicrotasks();

    expect(mockPermissionService.invalidateGroup).toHaveBeenCalledWith(
      mockPrisma,
      'group-1',
      'company-1',
    );
  });

  // =========================================================================
  // AC7 — accessGroup.deleted → invalidate group
  // =========================================================================

  it('invalidates group cache on accessGroup.deleted', async () => {
    registerPermissionCacheListeners(bus);

    bus.emit('accessGroup.deleted', {
      groupId: 'group-2',
      companyId: 'company-1',
      deletedBy: 'user-1',
    });

    await flushMicrotasks();

    expect(mockPermissionService.invalidateGroup).toHaveBeenCalledWith(
      mockPrisma,
      'group-2',
      'company-1',
    );
  });

  // =========================================================================
  // AC8 — user.accessGroups.assigned → invalidate user
  // =========================================================================

  it('invalidates user cache on user.accessGroups.assigned', async () => {
    registerPermissionCacheListeners(bus);

    bus.emit('user.accessGroups.assigned', {
      userId: 'user-1',
      companyId: 'company-1',
      groupIds: ['g1', 'g2'],
      assignedBy: 'admin-1',
    });

    await flushMicrotasks();

    expect(mockPermissionService.invalidateUser).toHaveBeenCalledWith(
      'user-1',
      'company-1',
    );
  });


  // =========================================================================
  // Error handling — invalidateGroup failure logged (Issue #13)
  // =========================================================================

  it('logs error when invalidateGroup fails on update', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('DB connection failed');
    mockPermissionService.invalidateGroup.mockRejectedValueOnce(error);

    registerPermissionCacheListeners(bus);

    bus.emit('accessGroup.updated', {
      groupId: 'group-1',
      companyId: 'company-1',
      changedBy: 'user-1',
    });

    // Wait for promise rejection to be caught
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[permission-cache] Failed to invalidate group cache on update:',
        error,
      );
    });

    consoleSpy.mockRestore();
  });

  it('logs error when invalidateGroup fails on delete', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('DB timeout');
    mockPermissionService.invalidateGroup.mockRejectedValueOnce(error);

    registerPermissionCacheListeners(bus);

    bus.emit('accessGroup.deleted', {
      groupId: 'group-1',
      companyId: 'company-1',
      deletedBy: 'user-1',
    });

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[permission-cache] Failed to invalidate group cache on delete:',
        error,
      );
    });

    consoleSpy.mockRestore();
  });

  // =========================================================================
  // resetPermissionCacheListeners — clears state
  // =========================================================================

  it('cleans up listeners on reset', async () => {
    registerPermissionCacheListeners(bus);
    resetPermissionCacheListeners();

    // Emitting events should not trigger any calls
    bus.emit('accessGroup.updated', {
      groupId: 'g1',
      companyId: 'c1',
      changedBy: 'u1',
    });
    bus.emit('accessGroup.deleted', {
      groupId: 'g1',
      companyId: 'c1',
      deletedBy: 'u1',
    });
    bus.emit('user.accessGroups.assigned', {
      userId: 'u1',
      companyId: 'c1',
      groupIds: [],
      assignedBy: 'u2',
    });

    await flushMicrotasks();

    expect(mockPermissionService.invalidateGroup).not.toHaveBeenCalled();
    expect(mockPermissionService.invalidateUser).not.toHaveBeenCalled();
  });

  it('allows re-registration after reset', async () => {
    registerPermissionCacheListeners(bus);
    resetPermissionCacheListeners();
    registerPermissionCacheListeners(bus);

    bus.emit('user.accessGroups.assigned', {
      userId: 'user-1',
      companyId: 'company-1',
      groupIds: ['g1'],
      assignedBy: 'admin-1',
    });

    await flushMicrotasks();

    expect(mockPermissionService.invalidateUser).toHaveBeenCalledTimes(1);
  });
});
