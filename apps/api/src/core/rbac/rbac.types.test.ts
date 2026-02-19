import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db — only need UserRole enum
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

import { UserRole } from '@nexa/db';
import { hasMinimumRole, ROLE_LEVEL } from './rbac.types.js';

// ---------------------------------------------------------------------------
// 4.2 — 5×5 matrix: every role against every minimum role (25 cases)
// ---------------------------------------------------------------------------

describe('hasMinimumRole', () => {
  const roles = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.VIEWER,
  ] as const;

  // Expected results matrix: [userRole][minimumRole] → true/false
  // Rows = user role, Columns = minimum required role
  //                    SA     ADM    MGR    STF    VWR
  // SUPER_ADMIN:     [ true,  true,  true,  true,  true  ]
  // ADMIN:           [ false, true,  true,  true,  true  ]
  // MANAGER:         [ false, false, true,  true,  true  ]
  // STAFF:           [ false, false, false, true,  true  ]
  // VIEWER:          [ false, false, false, false, true  ]

  const expected: Record<string, Record<string, boolean>> = {
    SUPER_ADMIN: { SUPER_ADMIN: true, ADMIN: true, MANAGER: true, STAFF: true, VIEWER: true },
    ADMIN: { SUPER_ADMIN: false, ADMIN: true, MANAGER: true, STAFF: true, VIEWER: true },
    MANAGER: { SUPER_ADMIN: false, ADMIN: false, MANAGER: true, STAFF: true, VIEWER: true },
    STAFF: { SUPER_ADMIN: false, ADMIN: false, MANAGER: false, STAFF: true, VIEWER: true },
    VIEWER: { SUPER_ADMIN: false, ADMIN: false, MANAGER: false, STAFF: false, VIEWER: true },
  };

  for (const userRole of roles) {
    for (const minimumRole of roles) {
      const expectedResult = expected[userRole]![minimumRole]!;
      const verb = expectedResult ? 'passes' : 'is denied';

      it(`${userRole} ${verb} when minimum is ${minimumRole}`, () => {
        expect(hasMinimumRole(userRole, minimumRole)).toBe(expectedResult);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 4.3 — Hierarchy is strictly ordered
  // ---------------------------------------------------------------------------

  describe('role hierarchy strict ordering', () => {
    it('SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER', () => {
      expect(ROLE_LEVEL[UserRole.SUPER_ADMIN]).toBeGreaterThan(ROLE_LEVEL[UserRole.ADMIN]);
      expect(ROLE_LEVEL[UserRole.ADMIN]).toBeGreaterThan(ROLE_LEVEL[UserRole.MANAGER]);
      expect(ROLE_LEVEL[UserRole.MANAGER]).toBeGreaterThan(ROLE_LEVEL[UserRole.STAFF]);
      expect(ROLE_LEVEL[UserRole.STAFF]).toBeGreaterThan(ROLE_LEVEL[UserRole.VIEWER]);
    });

    it('each level is unique (no ties)', () => {
      const levels = Object.values(ROLE_LEVEL);
      const unique = new Set(levels);
      expect(unique.size).toBe(levels.length);
    });

    it('ROLE_LEVEL covers all 5 roles', () => {
      for (const role of roles) {
        expect(ROLE_LEVEL[role]).toBeDefined();
        expect(typeof ROLE_LEVEL[role]).toBe('number');
      }
    });
  });
});
