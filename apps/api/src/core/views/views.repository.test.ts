import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    dataView: {
      findFirst: vi.fn(),
    },
    dateRangePreset: {
      findMany: vi.fn(),
    },
    savedView: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    savedViewCondition: {
      deleteMany: vi.fn(),
    },
    userColumnPreference: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  PrismaClient: vi.fn(),
  ViewScope: {
    PERSONAL: 'PERSONAL',
    ROLE: 'ROLE',
    GLOBAL: 'GLOBAL',
  },
  PinPosition: {
    NONE: 'NONE',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ViewsRepository } from './views.repository.js';
import type { CreateSavedViewData } from './views.repository.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const DATA_VIEW_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const SAVED_VIEW_ID = 'bbbbbbbb-0000-4000-a000-000000000001';
const FIELD_ID_1 = 'cccccccc-0000-4000-a000-000000000001';
const FIELD_ID_2 = 'cccccccc-0000-4000-a000-000000000002';
const ROLE_ID_1 = 'dddddddd-0000-4000-a000-000000000001';

const now = new Date('2026-01-01');

function sampleDataView(overrides: Record<string, unknown> = {}) {
  return {
    id: DATA_VIEW_ID,
    companyId: TEST_COMPANY_ID,
    viewKey: 'USERS',
    viewName: 'Users',
    entityTable: 'User',
    idField: 'id',
    defaultSortField: 'createdAt',
    defaultSortDir: 'DESC',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sampleField(overrides: Record<string, unknown> = {}) {
  return {
    id: FIELD_ID_1,
    dataViewId: DATA_VIEW_ID,
    fieldKey: 'email',
    fieldLabel: 'Email',
    fieldType: 'STRING',
    defaultVisible: true,
    defaultOrder: 1,
    defaultWidth: 250,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: 'NONE',
    lovScope: null,
    lovStaticValues: null,
    lovDependsOn: null,
    lovSearchMin: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sampleSavedView(overrides: Record<string, unknown> = {}) {
  return {
    id: SAVED_VIEW_ID,
    companyId: TEST_COMPANY_ID,
    dataViewId: DATA_VIEW_ID,
    name: 'My Filter',
    groupName: 'Custom',
    scope: 'PERSONAL',
    roleId: null,
    createdBy: TEST_USER_ID,
    isFavourite: false,
    favouriteOrder: 0,
    isDefault: false,
    filterLogic: 'AND',
    sortConfig: [],
    columnConfig: [],
    createdAt: now,
    updatedAt: now,
    conditions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let repo: ViewsRepository;

beforeEach(() => {
  vi.clearAllMocks();

  // Default $transaction: pass mockPrisma as the tx object
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );

  repo = new ViewsRepository(mockPrisma as never);
});

// ---------------------------------------------------------------------------
// getDataViewWithFields
// ---------------------------------------------------------------------------

describe('getDataViewWithFields', () => {
  it('returns DataView with fields ordered by defaultOrder', async () => {
    const dataView = {
      ...sampleDataView(),
      fields: [
        sampleField(),
        sampleField({ id: FIELD_ID_2, fieldKey: 'firstName', defaultOrder: 2 }),
      ],
    };
    mockPrisma.dataView.findFirst.mockResolvedValue(dataView);

    const result = await repo.getDataViewWithFields(TEST_COMPANY_ID, 'USERS');

    expect(mockPrisma.dataView.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: TEST_COMPANY_ID,
        viewKey: 'USERS',
        isActive: true,
      },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { defaultOrder: 'asc' },
        },
      },
    });
    expect(result).toEqual(dataView);
    expect(result!.fields).toHaveLength(2);
  });

  it('returns null when viewKey does not exist', async () => {
    mockPrisma.dataView.findFirst.mockResolvedValue(null);

    const result = await repo.getDataViewWithFields(TEST_COMPANY_ID, 'NONEXISTENT');

    expect(result).toBeNull();
  });

  it('includes companyId in WHERE clause', async () => {
    mockPrisma.dataView.findFirst.mockResolvedValue(null);

    await repo.getDataViewWithFields(TEST_COMPANY_ID, 'USERS');

    expect(mockPrisma.dataView.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// getDatePresets
// ---------------------------------------------------------------------------

describe('getDatePresets', () => {
  it('returns presets ordered by orderInList', async () => {
    const presets = [
      {
        id: 'p1',
        companyId: TEST_COMPANY_ID,
        presetKey: 'today',
        presetName: 'Today',
        orderInList: 1,
      },
      {
        id: 'p2',
        companyId: TEST_COMPANY_ID,
        presetKey: 'yesterday',
        presetName: 'Yesterday',
        orderInList: 2,
      },
    ];
    mockPrisma.dateRangePreset.findMany.mockResolvedValue(presets);

    const result = await repo.getDatePresets(TEST_COMPANY_ID);

    expect(mockPrisma.dateRangePreset.findMany).toHaveBeenCalledWith({
      where: { companyId: TEST_COMPANY_ID, isActive: true },
      orderBy: { orderInList: 'asc' },
    });
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getSavedViews — visibility filtering (PERSONAL/ROLE/GLOBAL)
// ---------------------------------------------------------------------------

describe('getSavedViews', () => {
  it('filters by PERSONAL (createdBy = userId), ROLE (roleId IN roleIds), and GLOBAL', async () => {
    const views = [sampleSavedView()];
    mockPrisma.savedView.findMany.mockResolvedValue(views);

    await repo.getSavedViews(TEST_COMPANY_ID, TEST_USER_ID, [ROLE_ID_1], DATA_VIEW_ID);

    expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith({
      where: {
        companyId: TEST_COMPANY_ID,
        dataViewId: DATA_VIEW_ID,
        OR: [
          { scope: 'PERSONAL', createdBy: TEST_USER_ID },
          { scope: 'ROLE', roleId: { in: [ROLE_ID_1] } },
          { scope: 'GLOBAL' },
        ],
      },
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
      orderBy: [{ isFavourite: 'desc' }, { favouriteOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('omits ROLE clause when roleIds is empty', async () => {
    mockPrisma.savedView.findMany.mockResolvedValue([]);

    await repo.getSavedViews(TEST_COMPANY_ID, TEST_USER_ID, [], DATA_VIEW_ID);

    const call = mockPrisma.savedView.findMany.mock.calls[0]![0];
    expect(call.where.OR).toEqual([
      { scope: 'PERSONAL', createdBy: TEST_USER_ID },
      { scope: 'GLOBAL' },
    ]);
  });

  it('includes companyId and dataViewId in WHERE clause', async () => {
    mockPrisma.savedView.findMany.mockResolvedValue([]);

    await repo.getSavedViews(TEST_COMPANY_ID, TEST_USER_ID, [], DATA_VIEW_ID);

    expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          dataViewId: DATA_VIEW_ID,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// getUserColumnPreferences
// ---------------------------------------------------------------------------

describe('getUserColumnPreferences', () => {
  it('returns preferences for given field IDs', async () => {
    const prefs = [
      {
        id: 'up1',
        userId: TEST_USER_ID,
        dataViewFieldId: FIELD_ID_1,
        visible: true,
        displayOrder: 0,
        width: 200,
        pinned: 'NONE',
      },
    ];
    mockPrisma.userColumnPreference.findMany.mockResolvedValue(prefs);

    const result = await repo.getUserColumnPreferences(TEST_USER_ID, [FIELD_ID_1, FIELD_ID_2]);

    expect(mockPrisma.userColumnPreference.findMany).toHaveBeenCalledWith({
      where: {
        userId: TEST_USER_ID,
        dataViewFieldId: { in: [FIELD_ID_1, FIELD_ID_2] },
      },
      orderBy: { displayOrder: 'asc' },
    });
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// createSavedView
// ---------------------------------------------------------------------------

describe('createSavedView', () => {
  it('creates saved view with nested conditions', async () => {
    const input: CreateSavedViewData = {
      companyId: TEST_COMPANY_ID,
      dataViewId: DATA_VIEW_ID,
      name: 'Active Users',
      groupName: 'Status Filters',
      scope: 'PERSONAL' as const,
      createdBy: TEST_USER_ID,
      isFavourite: false,
      isDefault: false,
      filterLogic: 'AND',
      sortConfig: [{ field: 'createdAt', direction: 'DESC', priority: 1 }],
      columnConfig: [],
      conditions: [
        {
          dataViewFieldId: FIELD_ID_1,
          operator: 'EQUALS' as const,
          value: 'true',
          conditionOrder: 0,
        },
      ],
    };

    const expectedResult = sampleSavedView({
      name: 'Active Users',
      conditions: [
        {
          id: 'cond-1',
          savedViewId: SAVED_VIEW_ID,
          dataViewFieldId: FIELD_ID_1,
          operator: 'EQUALS',
          value: 'true',
          valueList: null,
          datePresetId: null,
          groupId: 0,
          groupLogic: 'AND',
          outerLogic: 'AND',
          conditionOrder: 0,
        },
      ],
    });
    mockPrisma.savedView.create.mockResolvedValue(expectedResult);

    const result = await repo.createSavedView(input);

    expect(mockPrisma.savedView.create).toHaveBeenCalledWith({
      data: {
        companyId: TEST_COMPANY_ID,
        dataViewId: DATA_VIEW_ID,
        name: 'Active Users',
        groupName: 'Status Filters',
        scope: 'PERSONAL',
        roleId: undefined,
        createdBy: TEST_USER_ID,
        isFavourite: false,
        isDefault: false,
        filterLogic: 'AND',
        sortConfig: [{ field: 'createdAt', direction: 'DESC', priority: 1 }],
        columnConfig: [],
        conditions: {
          create: [
            {
              dataViewFieldId: FIELD_ID_1,
              operator: 'EQUALS',
              value: 'true',
              valueList: null,
              datePresetId: null,
              groupId: 0,
              groupLogic: 'AND',
              outerLogic: 'AND',
              conditionOrder: 0,
            },
          ],
        },
      },
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
    });
    expect(result.name).toBe('Active Users');
    expect(result.conditions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// updateSavedView
// ---------------------------------------------------------------------------

describe('updateSavedView', () => {
  it('updates fields without conditions (no transaction needed)', async () => {
    mockPrisma.savedView.update.mockResolvedValue(sampleSavedView({ name: 'Updated Name' }));

    const result = await repo.updateSavedView(SAVED_VIEW_ID, TEST_COMPANY_ID, {
      name: 'Updated Name',
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.savedView.update).toHaveBeenCalledWith({
      where: { id: SAVED_VIEW_ID, companyId: TEST_COMPANY_ID },
      data: { name: 'Updated Name' },
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
    });
    expect(result.name).toBe('Updated Name');
  });

  it('replaces conditions in a transaction when conditions are provided', async () => {
    const newConditions = [
      {
        dataViewFieldId: FIELD_ID_1,
        operator: 'CONTAINS' as const,
        value: 'admin',
        conditionOrder: 0,
      },
    ];

    mockPrisma.savedViewCondition.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.savedView.update.mockResolvedValue(sampleSavedView({ conditions: newConditions }));

    await repo.updateSavedView(SAVED_VIEW_ID, TEST_COMPANY_ID, { conditions: newConditions });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.savedViewCondition.deleteMany).toHaveBeenCalledWith({
      where: { savedViewId: SAVED_VIEW_ID },
    });
    expect(mockPrisma.savedView.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SAVED_VIEW_ID, companyId: TEST_COMPANY_ID },
        data: expect.objectContaining({
          conditions: {
            create: [
              {
                dataViewFieldId: FIELD_ID_1,
                operator: 'CONTAINS',
                value: 'admin',
                valueList: null,
                datePresetId: null,
                groupId: 0,
                groupLogic: 'AND',
                outerLogic: 'AND',
                conditionOrder: 0,
              },
            ],
          },
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// deleteSavedView
// ---------------------------------------------------------------------------

describe('deleteSavedView', () => {
  it('deletes saved view by id', async () => {
    mockPrisma.savedView.delete.mockResolvedValue({});

    await repo.deleteSavedView(SAVED_VIEW_ID, TEST_COMPANY_ID);

    expect(mockPrisma.savedView.delete).toHaveBeenCalledWith({
      where: { id: SAVED_VIEW_ID, companyId: TEST_COMPANY_ID },
    });
  });
});

// ---------------------------------------------------------------------------
// getSavedViewById
// ---------------------------------------------------------------------------

describe('getSavedViewById', () => {
  it('returns saved view with conditions', async () => {
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView());

    const result = await repo.getSavedViewById(SAVED_VIEW_ID, TEST_COMPANY_ID);

    expect(mockPrisma.savedView.findFirst).toHaveBeenCalledWith({
      where: { id: SAVED_VIEW_ID, companyId: TEST_COMPANY_ID },
      include: {
        conditions: {
          orderBy: { conditionOrder: 'asc' },
        },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.id).toBe(SAVED_VIEW_ID);
  });

  it('returns null when not found', async () => {
    mockPrisma.savedView.findFirst.mockResolvedValue(null);

    const result = await repo.getSavedViewById('nonexistent', TEST_COMPANY_ID);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toggleFavourite
// ---------------------------------------------------------------------------

describe('toggleFavourite', () => {
  it('updates isFavourite flag', async () => {
    mockPrisma.savedView.update.mockResolvedValue({});

    await repo.toggleFavourite(SAVED_VIEW_ID, TEST_COMPANY_ID, true);

    expect(mockPrisma.savedView.update).toHaveBeenCalledWith({
      where: { id: SAVED_VIEW_ID, companyId: TEST_COMPANY_ID },
      data: { isFavourite: true },
    });
  });
});

// ---------------------------------------------------------------------------
// getFavourites
// ---------------------------------------------------------------------------

describe('getFavourites', () => {
  it('returns favourited views with visibility filtering', async () => {
    mockPrisma.savedView.findMany.mockResolvedValue([sampleSavedView({ isFavourite: true })]);

    await repo.getFavourites(TEST_COMPANY_ID, TEST_USER_ID, [ROLE_ID_1]);

    expect(mockPrisma.savedView.findMany).toHaveBeenCalledWith({
      where: {
        companyId: TEST_COMPANY_ID,
        isFavourite: true,
        OR: [
          { scope: 'PERSONAL', createdBy: TEST_USER_ID },
          { scope: 'ROLE', roleId: { in: [ROLE_ID_1] } },
          { scope: 'GLOBAL' },
        ],
      },
      include: {
        dataView: { select: { viewKey: true } },
      },
      orderBy: [{ favouriteOrder: 'asc' }, { name: 'asc' }],
    });
  });
});

// ---------------------------------------------------------------------------
// setDefault — atomic unset + set
// ---------------------------------------------------------------------------

describe('setDefault', () => {
  it('atomically unsets existing default and sets new one in transaction', async () => {
    mockPrisma.savedView.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.savedView.update.mockResolvedValue({});

    await repo.setDefault(SAVED_VIEW_ID, TEST_COMPANY_ID, DATA_VIEW_ID, TEST_USER_ID, 'PERSONAL');

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Verify unset existing default
    expect(mockPrisma.savedView.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: TEST_COMPANY_ID,
        dataViewId: DATA_VIEW_ID,
        createdBy: TEST_USER_ID,
        scope: 'PERSONAL',
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Verify set new default
    expect(mockPrisma.savedView.update).toHaveBeenCalledWith({
      where: { id: SAVED_VIEW_ID, companyId: TEST_COMPANY_ID },
      data: { isDefault: true },
    });
  });

  it('handles case where no previous default exists', async () => {
    mockPrisma.savedView.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.savedView.update.mockResolvedValue({});

    await repo.setDefault(SAVED_VIEW_ID, TEST_COMPANY_ID, DATA_VIEW_ID, TEST_USER_ID, 'PERSONAL');

    // Should still call both operations
    expect(mockPrisma.savedView.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.savedView.update).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// updateColumnWidth — upserts correctly
// ---------------------------------------------------------------------------

describe('updateColumnWidth', () => {
  it('upserts column width preference', async () => {
    mockPrisma.userColumnPreference.upsert.mockResolvedValue({});

    await repo.updateColumnWidth(TEST_USER_ID, FIELD_ID_1, 300);

    expect(mockPrisma.userColumnPreference.upsert).toHaveBeenCalledWith({
      where: {
        userId_dataViewFieldId: {
          userId: TEST_USER_ID,
          dataViewFieldId: FIELD_ID_1,
        },
      },
      update: { width: 300 },
      create: {
        userId: TEST_USER_ID,
        dataViewFieldId: FIELD_ID_1,
        visible: true,
        displayOrder: 0,
        width: 300,
        pinned: 'NONE',
      },
    });
  });
});

// ---------------------------------------------------------------------------
// upsertColumnPreferences
// ---------------------------------------------------------------------------

describe('upsertColumnPreferences', () => {
  it('deletes existing and creates new preferences in transaction', async () => {
    mockPrisma.userColumnPreference.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.userColumnPreference.createMany.mockResolvedValue({ count: 2 });

    const prefs = [
      {
        dataViewFieldId: FIELD_ID_1,
        visible: true,
        displayOrder: 0,
        width: 200,
        pinned: 'NONE' as const,
      },
      {
        dataViewFieldId: FIELD_ID_2,
        visible: false,
        displayOrder: 1,
        width: 150,
        pinned: 'LEFT' as const,
      },
    ];

    await repo.upsertColumnPreferences(TEST_USER_ID, [FIELD_ID_1, FIELD_ID_2], prefs);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userColumnPreference.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: TEST_USER_ID,
        dataViewFieldId: { in: [FIELD_ID_1, FIELD_ID_2] },
      },
    });
    expect(mockPrisma.userColumnPreference.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: TEST_USER_ID,
          dataViewFieldId: FIELD_ID_1,
          visible: true,
          displayOrder: 0,
          width: 200,
          pinned: 'NONE',
        },
        {
          userId: TEST_USER_ID,
          dataViewFieldId: FIELD_ID_2,
          visible: false,
          displayOrder: 1,
          width: 150,
          pinned: 'LEFT',
        },
      ],
    });
  });
});
