import { describe, it, expect } from 'vitest';

import { NAVIGATION_MODULES, getFilteredModules } from './navigation-config';

describe('NAVIGATION_MODULES', () => {
  it('contains all 11 MVP modules plus AI', () => {
    const keys = NAVIGATION_MODULES.map((m) => m.key);
    expect(keys).toEqual([
      'finance',
      'ar',
      'ap',
      'sales',
      'purchasing',
      'inventory',
      'crm',
      'hr',
      'manufacturing',
      'reporting',
      'ai',
      'system',
    ]);
  });

  it('every module has a non-empty key, labelKey, icon, and items array', () => {
    for (const mod of NAVIGATION_MODULES) {
      expect(mod.key).toBeTruthy();
      expect(mod.labelKey).toBeTruthy();
      expect(mod.icon).toBeTruthy();
      expect(Array.isArray(mod.items)).toBe(true);
      expect(mod.items.length).toBeGreaterThan(0);
    }
  });

  it('every item has a non-empty key, labelKey, icon, and path starting with /', () => {
    for (const mod of NAVIGATION_MODULES) {
      for (const item of mod.items) {
        expect(item.key).toBeTruthy();
        expect(item.labelKey).toBeTruthy();
        expect(item.icon).toBeTruthy();
        expect(item.path).toMatch(/^\//);
      }
    }
  });

  it('item paths start with the module pathPrefix', () => {
    // Known exception: system.documentTemplates lives under /settings/ not /system/
    const KNOWN_EXCEPTIONS = new Set(['system.documentTemplates']);

    for (const mod of NAVIGATION_MODULES) {
      for (const item of mod.items) {
        if (KNOWN_EXCEPTIONS.has(item.key)) continue;
        expect(item.path).toMatch(new RegExp(`^${mod.pathPrefix}/`));
      }
    }
  });
});

describe('getFilteredModules', () => {
  it('returns enabled modules plus modules with alwaysVisible items', () => {
    const result = getFilteredModules(['finance', 'sales']);
    const keys = result.map((m) => m.key);

    // system appears because system.myPermissions is alwaysVisible
    expect(keys).toContain('finance');
    expect(keys).toContain('sales');
    // Modules with only alwaysVisible items should only contain those items
    const systemMod = result.find((m) => m.key === 'system');
    if (systemMod) {
      expect(systemMod.items.every((i) => i.alwaysVisible)).toBe(true);
    }
    // Non-enabled, non-alwaysVisible modules should be absent
    expect(keys).not.toContain('hr');
    expect(keys).not.toContain('crm');
  });

  it('returns only modules with alwaysVisible items when enabledModules is empty', () => {
    const result = getFilteredModules([]);
    // Only modules that contain alwaysVisible items survive (e.g., system.myPermissions)
    expect(result.length).toBeGreaterThan(0);
    for (const mod of result) {
      expect(mod.items.every((item) => item.alwaysVisible)).toBe(true);
    }
  });

  it('returns all modules for SUPER_ADMIN regardless of enabledModules', () => {
    const result = getFilteredModules([], true);
    expect(result).toHaveLength(NAVIGATION_MODULES.length);
    expect(result).toEqual(NAVIGATION_MODULES);
  });

  it('returns all modules for SUPER_ADMIN even with partial enabledModules', () => {
    const result = getFilteredModules(['finance'], true);
    expect(result).toHaveLength(NAVIGATION_MODULES.length);
  });

  it('ignores unknown module keys in enabledModules', () => {
    const result = getFilteredModules(['finance', 'nonexistent']);
    const keys = result.map((m) => m.key);

    expect(keys).toContain('finance');
    expect(keys).not.toContain('nonexistent');
    // Modules with alwaysVisible items may also appear (e.g., system)
    for (const mod of result) {
      if (mod.key !== 'finance') {
        expect(mod.items.every((i) => i.alwaysVisible)).toBe(true);
      }
    }
  });

  it('preserves module order from NAVIGATION_MODULES', () => {
    // Pass modules in reverse order — result should still follow NAVIGATION_MODULES order
    // AI module also appears because all its items are alwaysVisible
    const result = getFilteredModules(['reporting', 'finance', 'system']);
    const keys = result.map((m) => m.key);

    expect(keys).toEqual(['finance', 'reporting', 'ai', 'system']);
  });
});

describe('getFilteredModules — item-level filtering', () => {
  it('filters out items where canAccess=false for their resourceCode', () => {
    const modulePermissions = {
      'system.users.list': {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: false,
      },
      'system.company-profile.detail': {
        canAccess: false,
        canNew: false,
        canView: false,
        canEdit: false,
        canDelete: false,
      },
    };

    const result = getFilteredModules(['system'], false, modulePermissions);
    const systemModule = result.find((m) => m.key === 'system');

    expect(systemModule).toBeDefined();
    // 'system.users' has canAccess=true → visible
    expect(systemModule!.items.some((i) => i.key === 'system.users')).toBe(true);
    // 'system.companies' has canAccess=false → hidden
    expect(systemModule!.items.some((i) => i.key === 'system.companies')).toBe(false);
  });

  it('keeps items without resourceCode when items with resourceCode are all denied', () => {
    const modulePermissions = {
      'system.users.list': {
        canAccess: false,
        canNew: false,
        canView: false,
        canEdit: false,
        canDelete: false,
      },
      'system.company-profile.detail': {
        canAccess: false,
        canNew: false,
        canView: false,
        canEdit: false,
        canDelete: false,
      },
    };

    const result = getFilteredModules(['system'], false, modulePermissions);
    const systemModule = result.find((m) => m.key === 'system');

    // system.settings and system.myPermissions have no resourceCode → always visible
    expect(systemModule).toBeDefined();
    expect(systemModule!.items.some((i) => i.key === 'system.settings')).toBe(true);
    expect(systemModule!.items.some((i) => i.key === 'system.myPermissions')).toBe(true);
    // Items with failing resourceCodes should be filtered
    expect(systemModule!.items.some((i) => i.key === 'system.users')).toBe(false);
    expect(systemModule!.items.some((i) => i.key === 'system.companies')).toBe(false);
  });

  it('returns all modules and items for SUPER_ADMIN regardless of item permissions', () => {
    const modulePermissions = {
      'system.users.list': {
        canAccess: false,
        canNew: false,
        canView: false,
        canEdit: false,
        canDelete: false,
      },
    };

    const result = getFilteredModules([], true, modulePermissions);

    expect(result).toEqual(NAVIGATION_MODULES);
    expect(result).toHaveLength(NAVIGATION_MODULES.length);
  });

  it('items without resourceCode are always included', () => {
    const result = getFilteredModules(['system'], false, {});
    const systemModule = result.find((m) => m.key === 'system');

    expect(systemModule).toBeDefined();
    // Items without resourceCode should be visible
    expect(systemModule!.items.some((i) => i.key === 'system.settings')).toBe(true);
    expect(systemModule!.items.some((i) => i.key === 'system.myPermissions')).toBe(true);
    // Items with resourceCode not in modulePermissions → fail-closed (hidden)
    expect(systemModule!.items.some((i) => i.key === 'system.users')).toBe(false);
    expect(systemModule!.items.some((i) => i.key === 'system.companies')).toBe(false);
  });

  it('items with resourceCode not in permissions map are hidden (fail-closed)', () => {
    const result = getFilteredModules(['system'], false, {});
    const systemModule = result.find((m) => m.key === 'system');

    expect(systemModule).toBeDefined();
    const itemsWithResourceCode = systemModule!.items.filter((i) => i.resourceCode);
    expect(itemsWithResourceCode).toHaveLength(0);
  });

  it('handles undefined modulePermissions gracefully', () => {
    const result = getFilteredModules(['system'], false, undefined);
    const systemModule = result.find((m) => m.key === 'system');

    expect(systemModule).toBeDefined();
    // Items without resourceCode should pass
    expect(systemModule!.items.some((i) => i.key === 'system.settings')).toBe(true);
    // Items with resourceCode should be filtered out (undefined?.canAccess !== true)
    expect(systemModule!.items.some((i) => i.key === 'system.users')).toBe(false);
  });

  it('module shows only alwaysVisible items when not in enabledModules even with item permissions', () => {
    const modulePermissions = {
      'system.users.list': {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      },
    };

    // system not in enabledModules — only alwaysVisible items survive
    const result = getFilteredModules(['finance'], false, modulePermissions);
    const systemModule = result.find((m) => m.key === 'system');

    // System module still appears because of alwaysVisible items (e.g., myPermissions)
    const alwaysVisibleItems = NAVIGATION_MODULES.find((m) => m.key === 'system')!.items.filter(
      (i) => i.alwaysVisible,
    );

    if (alwaysVisibleItems.length > 0) {
      expect(systemModule).toBeDefined();
      expect(systemModule!.items.every((i) => i.alwaysVisible)).toBe(true);
      // Non-alwaysVisible items with permissions should still be hidden
      expect(systemModule!.items.some((i) => i.key === 'system.users')).toBe(false);
    } else {
      expect(systemModule).toBeUndefined();
    }
  });
});
