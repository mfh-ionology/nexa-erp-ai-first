import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockGetVisibleCompanyIds } = vi.hoisted(() => ({
  mockGetVisibleCompanyIds: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  getVisibleCompanyIds: mockGetVisibleCompanyIds,
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { buildCompanyFilter } from './company-query.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const COMPANY_A = '11111111-1111-4000-a000-111111111111';
const COMPANY_B = '22222222-2222-4000-a000-222222222222';
const COMPANY_C = '33333333-3333-4000-a000-333333333333';

// Fake PrismaClient — the function passes it through to getVisibleCompanyIds
const fakePrisma = {} as Parameters<typeof buildCompanyFilter>[0];

// ---------------------------------------------------------------------------
// Tests (Task 6)
// ---------------------------------------------------------------------------

describe('buildCompanyFilter', () => {
  // 6.5 — No entityType provided → returns simple { companyId }
  it('returns single companyId filter when no entityType is provided', async () => {
    const result = await buildCompanyFilter(fakePrisma, COMPANY_A);

    expect(result).toEqual({ companyId: COMPANY_A });
    expect(mockGetVisibleCompanyIds).not.toHaveBeenCalled();
  });

  // 6.5 — Explicit undefined entityType
  it('returns single companyId filter when entityType is undefined', async () => {
    const result = await buildCompanyFilter(fakePrisma, COMPANY_A, undefined);

    expect(result).toEqual({ companyId: COMPANY_A });
    expect(mockGetVisibleCompanyIds).not.toHaveBeenCalled();
  });

  // 6.2 — No sharing rules → getVisibleCompanyIds returns only the requesting company
  it('returns single companyId filter when no sharing rules exist', async () => {
    mockGetVisibleCompanyIds.mockResolvedValue([COMPANY_A]);

    const result = await buildCompanyFilter(fakePrisma, COMPANY_A, 'Customer');

    expect(result).toEqual({ companyId: COMPANY_A });
    expect(mockGetVisibleCompanyIds).toHaveBeenCalledWith(fakePrisma, COMPANY_A, 'Customer');
  });

  // 6.3 — SELECTED sharing → returns { companyId: { in: [...] } }
  it('returns multi-company filter when SELECTED sharing rules expose additional companies', async () => {
    mockGetVisibleCompanyIds.mockResolvedValue([COMPANY_A, COMPANY_B]);

    const result = await buildCompanyFilter(fakePrisma, COMPANY_A, 'Customer');

    expect(result).toEqual({ companyId: { in: [COMPANY_A, COMPANY_B] } });
    expect(mockGetVisibleCompanyIds).toHaveBeenCalledWith(fakePrisma, COMPANY_A, 'Customer');
  });

  // 6.4 — ALL_COMPANIES sharing → returns { companyId: { in: [...] } } with all IDs
  it('returns multi-company filter when ALL_COMPANIES sharing exposes all companies', async () => {
    mockGetVisibleCompanyIds.mockResolvedValue([COMPANY_A, COMPANY_B, COMPANY_C]);

    const result = await buildCompanyFilter(fakePrisma, COMPANY_A, 'Invoice');

    expect(result).toEqual({ companyId: { in: [COMPANY_A, COMPANY_B, COMPANY_C] } });
    expect(mockGetVisibleCompanyIds).toHaveBeenCalledWith(fakePrisma, COMPANY_A, 'Invoice');
  });

  // 6.6 — Verify getVisibleCompanyIds is mocked (not hitting real DB)
  it('passes prisma client and parameters through to getVisibleCompanyIds', async () => {
    mockGetVisibleCompanyIds.mockResolvedValue([COMPANY_B]);

    await buildCompanyFilter(fakePrisma, COMPANY_B, 'Supplier');

    expect(mockGetVisibleCompanyIds).toHaveBeenLastCalledWith(fakePrisma, COMPANY_B, 'Supplier');
  });
});
