import { describe, expect, it, vi, beforeEach } from 'vitest';

import { applyViewFilters } from './apply-view-filters.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const COMPANY_ID = 'company-1';
const VIEW_KEY = 'USERS';

const mockFields = [
  { id: 'field-role', fieldKey: 'role', fieldType: 'ENUM' },
  { id: 'field-active', fieldKey: 'isActive', fieldType: 'BOOLEAN' },
  { id: 'field-email', fieldKey: 'email', fieldType: 'STRING' },
  { id: 'field-created', fieldKey: 'createdAt', fieldType: 'DATE' },
];

const mockDatePresets = [
  { id: 'preset-today', presetKey: 'today' },
  { id: 'preset-last7', presetKey: 'last7days' },
];

function createMockPrisma(hasDataView = true) {
  return {
    dataView: {
      findFirst: vi.fn().mockResolvedValue(
        hasDataView
          ? {
              id: 'dv-1',
              viewKey: VIEW_KEY,
              fields: mockFields,
            }
          : null,
      ),
    },
    dateRangePreset: {
      findMany: vi.fn().mockResolvedValue(mockDatePresets),
    },
  } as unknown as Parameters<typeof applyViewFilters>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyViewFilters', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it('returns empty object when no conditions provided', async () => {
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, undefined);
    expect(result).toEqual({});
  });

  it('returns empty object when conditions is empty string', async () => {
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, '');
    expect(result).toEqual({});
  });

  it('returns empty object when conditions is invalid JSON', async () => {
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, 'not-json');
    expect(result).toEqual({});
  });

  it('returns empty object when conditions is empty array', async () => {
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, '[]');
    expect(result).toEqual({});
  });

  it('returns empty object when dataView not found', async () => {
    prisma = createMockPrisma(false);
    const conditions = JSON.stringify([
      {
        dataViewFieldId: 'field-role',
        operator: 'EQUALS',
        value: 'ADMIN',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ]);
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, conditions);
    expect(result).toEqual({});
  });

  it('builds where clause for single EQUALS condition', async () => {
    const conditions = JSON.stringify([
      {
        dataViewFieldId: 'field-role',
        operator: 'EQUALS',
        value: 'SUPER_ADMIN',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ]);
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, conditions);
    expect(result).toEqual({ role: { equals: 'SUPER_ADMIN' } });
  });

  it('builds where clause for multiple AND conditions', async () => {
    const conditions = JSON.stringify([
      {
        dataViewFieldId: 'field-role',
        operator: 'EQUALS',
        value: 'STAFF',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
      {
        dataViewFieldId: 'field-active',
        operator: 'EQUALS',
        value: 'true',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 1,
      },
    ]);
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, conditions, 'AND');
    expect(result).toEqual({
      AND: [{ role: { equals: 'STAFF' } }, { isActive: { equals: true } }],
    });
  });

  it('builds where clause for OR conditions', async () => {
    const conditions = JSON.stringify([
      {
        dataViewFieldId: 'field-role',
        operator: 'EQUALS',
        value: 'ADMIN',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'OR',
        outerLogic: 'OR',
        conditionOrder: 0,
      },
      {
        dataViewFieldId: 'field-role',
        operator: 'EQUALS',
        value: 'STAFF',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'OR',
        outerLogic: 'OR',
        conditionOrder: 1,
      },
    ]);
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, conditions, 'OR');
    expect(result).toEqual({
      OR: [{ role: { equals: 'ADMIN' } }, { role: { equals: 'STAFF' } }],
    });
  });

  it('builds where clause for CONTAINS string operator', async () => {
    const conditions = JSON.stringify([
      {
        dataViewFieldId: 'field-email',
        operator: 'CONTAINS',
        value: 'nexa',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ]);
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, conditions);
    expect(result).toEqual({
      email: { contains: 'nexa', mode: 'insensitive' },
    });
  });

  it('loads field metadata scoped to companyId and viewKey', async () => {
    const conditions = JSON.stringify([
      {
        dataViewFieldId: 'field-role',
        operator: 'EQUALS',
        value: 'ADMIN',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ]);
    await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, conditions);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.dataView.findFirst).toHaveBeenCalledWith({
      where: { companyId: COMPANY_ID, viewKey: VIEW_KEY },
      include: {
        fields: {
          where: { isActive: true, filterable: true },
          select: { id: true, fieldKey: true, fieldType: true },
        },
      },
    });
  });

  it('defaults filterLogic to AND', async () => {
    const conditions = JSON.stringify([
      {
        dataViewFieldId: 'field-role',
        operator: 'EQUALS',
        value: 'ADMIN',
        valueList: null,
        datePresetId: null,
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      },
    ]);
    const result = await applyViewFilters(prisma, COMPANY_ID, VIEW_KEY, conditions);
    // Single condition — should be flat, not wrapped in AND
    expect(result).toEqual({ role: { equals: 'ADMIN' } });
  });
});
