import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies — vi.hoisted ensures variables exist when vi.mock runs
// ---------------------------------------------------------------------------

const { mockRepo, mockRedis, mockLogger } = vi.hoisted(() => ({
  mockRepo: {
    getDataViewWithFields: vi.fn(),
    getDatePresets: vi.fn(),
    getSavedViews: vi.fn(),
    getUserColumnPreferences: vi.fn(),
    createSavedView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    getSavedViewById: vi.fn(),
    toggleFavourite: vi.fn(),
    getFavourites: vi.fn(),
    setDefault: vi.fn(),
    upsertColumnPreferences: vi.fn(),
    updateColumnWidth: vi.fn(),
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
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

import { ViewsService } from './views.service.js';
import { ViewNotFoundError, ViewScopeForbiddenError } from './views.errors.js';

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
const OTHER_USER_ID = 'eeeeeeee-0000-4000-a000-000000000001';

const now = new Date('2026-01-01');

const CACHE_KEY_USERS = `${TEST_COMPANY_ID}:views:meta:USERS`;

function sampleDataViewWithFields(overrides: Record<string, unknown> = {}) {
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
    fields: [
      {
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
      },
      {
        id: FIELD_ID_2,
        dataViewId: DATA_VIEW_ID,
        fieldKey: 'firstName',
        fieldLabel: 'First Name',
        fieldType: 'STRING',
        defaultVisible: true,
        defaultOrder: 2,
        defaultWidth: 150,
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
      },
    ],
    ...overrides,
  };
}

function sampleDatePresets() {
  return [
    {
      id: 'p1',
      companyId: TEST_COMPANY_ID,
      presetKey: 'today',
      presetName: 'Today',
      orderInList: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'p2',
      companyId: TEST_COMPANY_ID,
      presetKey: 'yesterday',
      presetName: 'Yesterday',
      orderInList: 2,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
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

let service: ViewsService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new ViewsService(mockRepo as never, mockRedis as never, mockLogger as never);
});

// ---------------------------------------------------------------------------
// getViewInit
// ---------------------------------------------------------------------------

describe('getViewInit', () => {
  it('returns bundled response and populates cache on miss', async () => {
    // Cache miss
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const dataView = sampleDataViewWithFields();
    const datePresets = sampleDatePresets();

    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);
    mockRepo.getDatePresets.mockResolvedValue(datePresets);
    mockRepo.getSavedViews.mockResolvedValue([sampleSavedView()]);
    mockRepo.getUserColumnPreferences.mockResolvedValue([]);

    const result = await service.getViewInit(TEST_COMPANY_ID, TEST_USER_ID, [ROLE_ID_1], 'USERS');

    // Verify cache was checked
    expect(mockRedis.get).toHaveBeenCalledWith(CACHE_KEY_USERS);

    // Verify cache was populated
    expect(mockRedis.set).toHaveBeenCalledWith(CACHE_KEY_USERS, expect.any(String), 'EX', 3600);

    // Verify response shape
    expect(result.dataView.viewKey).toBe('USERS');
    expect(result.dataView.id).toBe(DATA_VIEW_ID);
    expect(result.fields).toHaveLength(2);
    expect(result.datePresets).toHaveLength(2);
    expect(result.savedViews).toHaveLength(1);
    expect(result.savedViews[0]!.name).toBe('My Filter');
    expect(result.userColumnPreferences).toBeNull();
  });

  it('uses cached metadata on cache hit', async () => {
    // Cache hit — return cached metadata
    const cachedMetadata = {
      dataView: {
        id: DATA_VIEW_ID,
        viewKey: 'USERS',
        viewName: 'Users',
        entityTable: 'User',
        idField: 'id',
        defaultSortField: 'createdAt',
        defaultSortDir: 'DESC',
      },
      fields: [
        {
          id: FIELD_ID_1,
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
        },
      ],
      datePresets: [{ id: 'p1', presetKey: 'today', presetName: 'Today', orderInList: 1 }],
    };

    mockRedis.get.mockResolvedValue(JSON.stringify(cachedMetadata));
    mockRepo.getSavedViews.mockResolvedValue([]);
    mockRepo.getUserColumnPreferences.mockResolvedValue([]);

    const result = await service.getViewInit(TEST_COMPANY_ID, TEST_USER_ID, [], 'USERS');

    // Should NOT call getDataViewWithFields or getDatePresets (cache hit)
    expect(mockRepo.getDataViewWithFields).not.toHaveBeenCalled();
    expect(mockRepo.getDatePresets).not.toHaveBeenCalled();

    // Should NOT populate cache (already cached)
    expect(mockRedis.set).not.toHaveBeenCalled();

    // Should still fetch user-specific data
    expect(mockRepo.getSavedViews).toHaveBeenCalledWith(
      TEST_COMPANY_ID,
      TEST_USER_ID,
      [],
      DATA_VIEW_ID,
    );

    expect(result.dataView.viewKey).toBe('USERS');
    expect(result.fields).toHaveLength(1);
    expect(result.datePresets).toHaveLength(1);
  });

  it('throws ViewNotFoundError when viewKey does not exist', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRepo.getDataViewWithFields.mockResolvedValue(null);

    await expect(
      service.getViewInit(TEST_COMPANY_ID, TEST_USER_ID, [], 'NONEXISTENT'),
    ).rejects.toThrow(ViewNotFoundError);
  });

  it('returns userColumnPreferences when they exist', async () => {
    mockRedis.get.mockResolvedValue(null);

    const dataView = sampleDataViewWithFields();
    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);
    mockRepo.getDatePresets.mockResolvedValue([]);
    mockRepo.getSavedViews.mockResolvedValue([]);

    const prefs = [
      {
        id: 'up1',
        userId: TEST_USER_ID,
        dataViewFieldId: FIELD_ID_1,
        visible: true,
        displayOrder: 0,
        width: 200,
        pinned: 'NONE',
        createdAt: now,
        updatedAt: now,
      },
    ];
    mockRepo.getUserColumnPreferences.mockResolvedValue(prefs);

    const result = await service.getViewInit(TEST_COMPANY_ID, TEST_USER_ID, [], 'USERS');

    expect(result.userColumnPreferences).not.toBeNull();
    expect(result.userColumnPreferences).toHaveLength(1);
    expect(result.userColumnPreferences![0]!.dataViewFieldId).toBe(FIELD_ID_1);
  });

  it('invalidates corrupt cache and fetches from DB', async () => {
    // Return invalid JSON
    mockRedis.get.mockResolvedValue('{invalid json}');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    const dataView = sampleDataViewWithFields();
    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);
    mockRepo.getDatePresets.mockResolvedValue([]);
    mockRepo.getSavedViews.mockResolvedValue([]);
    mockRepo.getUserColumnPreferences.mockResolvedValue([]);

    const result = await service.getViewInit(TEST_COMPANY_ID, TEST_USER_ID, [], 'USERS');

    // Should have logged warning and deleted bad cache
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith(CACHE_KEY_USERS);

    // Should still succeed by fetching from DB
    expect(result.dataView.viewKey).toBe('USERS');
  });
});

// ---------------------------------------------------------------------------
// createSavedView — scope enforcement
// ---------------------------------------------------------------------------

describe('createSavedView', () => {
  it('creates a PERSONAL view for STAFF user', async () => {
    const dataView = sampleDataViewWithFields();
    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);

    const createdView = sampleSavedView({ name: 'Active Users' });
    mockRepo.createSavedView.mockResolvedValue(createdView);

    const result = await service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'STAFF', {
      viewKey: 'USERS',
      name: 'Active Users',
      groupName: 'Status Filters',
      scope: 'PERSONAL',
      filterLogic: 'AND',
      sortConfig: [],
      columnConfig: [],
      conditions: [],
    });

    expect(result.name).toBe('Active Users');
    expect(mockRepo.createSavedView).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: TEST_COMPANY_ID,
        dataViewId: DATA_VIEW_ID,
        name: 'Active Users',
        scope: 'PERSONAL',
        createdBy: TEST_USER_ID,
      }),
    );
  });

  it('creates a ROLE view for STAFF user with roleId', async () => {
    const dataView = sampleDataViewWithFields();
    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);

    const createdView = sampleSavedView({ scope: 'ROLE', roleId: ROLE_ID_1 });
    mockRepo.createSavedView.mockResolvedValue(createdView);

    await service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'STAFF', {
      viewKey: 'USERS',
      name: 'Team View',
      groupName: 'Team',
      scope: 'ROLE',
      roleId: ROLE_ID_1,
      filterLogic: 'AND',
      sortConfig: [],
      columnConfig: [],
      conditions: [],
    });

    expect(mockRepo.createSavedView).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'ROLE',
        roleId: ROLE_ID_1,
      }),
    );
  });

  it('allows ADMIN to create GLOBAL view', async () => {
    const dataView = sampleDataViewWithFields();
    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);

    const createdView = sampleSavedView({ scope: 'GLOBAL' });
    mockRepo.createSavedView.mockResolvedValue(createdView);

    await expect(
      service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'ADMIN', {
        viewKey: 'USERS',
        name: 'All Active',
        groupName: 'Global',
        scope: 'GLOBAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      }),
    ).resolves.not.toThrow();

    expect(mockRepo.createSavedView).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'GLOBAL' }),
    );
  });

  it('allows SUPER_ADMIN to create GLOBAL view', async () => {
    const dataView = sampleDataViewWithFields();
    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);

    const createdView = sampleSavedView({ scope: 'GLOBAL' });
    mockRepo.createSavedView.mockResolvedValue(createdView);

    await expect(
      service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'SUPER_ADMIN', {
        viewKey: 'USERS',
        name: 'Default',
        groupName: 'Global',
        scope: 'GLOBAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      }),
    ).resolves.not.toThrow();
  });

  it('rejects GLOBAL view creation by non-admin (STAFF)', async () => {
    await expect(
      service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'STAFF', {
        viewKey: 'USERS',
        name: 'Attempt Global',
        groupName: 'Global',
        scope: 'GLOBAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      }),
    ).rejects.toThrow(ViewScopeForbiddenError);
  });

  it('rejects GLOBAL view creation by VIEWER', async () => {
    await expect(
      service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'VIEWER', {
        viewKey: 'USERS',
        name: 'Attempt Global',
        groupName: 'Global',
        scope: 'GLOBAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      }),
    ).rejects.toThrow(ViewScopeForbiddenError);
  });

  it('rejects GLOBAL view creation by MANAGER', async () => {
    await expect(
      service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'MANAGER', {
        viewKey: 'USERS',
        name: 'Attempt Global',
        groupName: 'Global',
        scope: 'GLOBAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      }),
    ).rejects.toThrow(ViewScopeForbiddenError);
  });

  it('throws ViewNotFoundError when viewKey does not exist', async () => {
    mockRepo.getDataViewWithFields.mockResolvedValue(null);

    await expect(
      service.createSavedView(TEST_COMPANY_ID, TEST_USER_ID, 'STAFF', {
        viewKey: 'NONEXISTENT',
        name: 'Test',
        groupName: 'Test',
        scope: 'PERSONAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      }),
    ).rejects.toThrow(ViewNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// updateSavedView — ownership enforcement
// ---------------------------------------------------------------------------

describe('updateSavedView', () => {
  it('allows owner to update their view', async () => {
    const existing = sampleSavedView({ createdBy: TEST_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);

    const updated = sampleSavedView({ name: 'Updated Name' });
    mockRepo.updateSavedView.mockResolvedValue(updated);

    const result = await service.updateSavedView(
      TEST_COMPANY_ID,
      SAVED_VIEW_ID,
      TEST_USER_ID,
      'STAFF',
      { name: 'Updated Name' },
    );

    expect(result.name).toBe('Updated Name');
    expect(mockRepo.updateSavedView).toHaveBeenCalledWith(
      SAVED_VIEW_ID,
      TEST_COMPANY_ID,
      expect.objectContaining({ name: 'Updated Name' }),
    );
  });

  it('allows ADMIN to update any view', async () => {
    const existing = sampleSavedView({ createdBy: OTHER_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);

    const updated = sampleSavedView({ name: 'Admin Update' });
    mockRepo.updateSavedView.mockResolvedValue(updated);

    await expect(
      service.updateSavedView(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'ADMIN', {
        name: 'Admin Update',
      }),
    ).resolves.not.toThrow();
  });

  it('rejects non-owner non-admin update', async () => {
    const existing = sampleSavedView({ createdBy: OTHER_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);

    await expect(
      service.updateSavedView(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'STAFF', {
        name: 'Blocked',
      }),
    ).rejects.toThrow(ViewScopeForbiddenError);
  });

  it('throws ViewNotFoundError when view does not exist', async () => {
    mockRepo.getSavedViewById.mockResolvedValue(null);

    await expect(
      service.updateSavedView(TEST_COMPANY_ID, 'nonexistent', TEST_USER_ID, 'STAFF', { name: 'X' }),
    ).rejects.toThrow(ViewNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// deleteSavedView — ownership enforcement
// ---------------------------------------------------------------------------

describe('deleteSavedView', () => {
  it('allows owner to delete their view', async () => {
    const existing = sampleSavedView({ createdBy: TEST_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.deleteSavedView.mockResolvedValue(undefined);

    await service.deleteSavedView(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'STAFF');

    expect(mockRepo.deleteSavedView).toHaveBeenCalledWith(SAVED_VIEW_ID, TEST_COMPANY_ID);
  });

  it('allows ADMIN to delete any view', async () => {
    const existing = sampleSavedView({ createdBy: OTHER_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.deleteSavedView.mockResolvedValue(undefined);

    await service.deleteSavedView(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'ADMIN');

    expect(mockRepo.deleteSavedView).toHaveBeenCalledWith(SAVED_VIEW_ID, TEST_COMPANY_ID);
  });

  it('rejects non-owner non-admin deletion', async () => {
    const existing = sampleSavedView({ createdBy: OTHER_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);

    await expect(
      service.deleteSavedView(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'STAFF'),
    ).rejects.toThrow(ViewScopeForbiddenError);
  });

  it('throws ViewNotFoundError when view does not exist', async () => {
    mockRepo.getSavedViewById.mockResolvedValue(null);

    await expect(
      service.deleteSavedView(TEST_COMPANY_ID, 'nonexistent', TEST_USER_ID, 'STAFF'),
    ).rejects.toThrow(ViewNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// toggleFavourite
// ---------------------------------------------------------------------------

describe('toggleFavourite', () => {
  it('toggles favourite flag from false to true for own PERSONAL view', async () => {
    const existing = sampleSavedView({
      isFavourite: false,
      scope: 'PERSONAL',
      createdBy: TEST_USER_ID,
    });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.toggleFavourite.mockResolvedValue(undefined);

    await service.toggleFavourite(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, []);

    expect(mockRepo.toggleFavourite).toHaveBeenCalledWith(SAVED_VIEW_ID, TEST_COMPANY_ID, true);
  });

  it('toggles favourite flag from true to false', async () => {
    const existing = sampleSavedView({
      isFavourite: true,
      scope: 'PERSONAL',
      createdBy: TEST_USER_ID,
    });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.toggleFavourite.mockResolvedValue(undefined);

    await service.toggleFavourite(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, []);

    expect(mockRepo.toggleFavourite).toHaveBeenCalledWith(SAVED_VIEW_ID, TEST_COMPANY_ID, false);
  });

  it('allows toggling favourite on a GLOBAL view the user can see', async () => {
    const existing = sampleSavedView({
      isFavourite: false,
      scope: 'GLOBAL',
      createdBy: OTHER_USER_ID,
    });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.toggleFavourite.mockResolvedValue(undefined);

    await service.toggleFavourite(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, []);

    expect(mockRepo.toggleFavourite).toHaveBeenCalledWith(SAVED_VIEW_ID, TEST_COMPANY_ID, true);
  });

  it('allows toggling favourite on a ROLE view the user has access to', async () => {
    const existing = sampleSavedView({
      isFavourite: false,
      scope: 'ROLE',
      roleId: ROLE_ID_1,
      createdBy: OTHER_USER_ID,
    });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.toggleFavourite.mockResolvedValue(undefined);

    await service.toggleFavourite(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, [ROLE_ID_1]);

    expect(mockRepo.toggleFavourite).toHaveBeenCalledWith(SAVED_VIEW_ID, TEST_COMPANY_ID, true);
  });

  it('throws ViewScopeForbiddenError for ROLE view user cannot see', async () => {
    const existing = sampleSavedView({
      isFavourite: false,
      scope: 'ROLE',
      roleId: ROLE_ID_1,
      createdBy: OTHER_USER_ID,
    });
    mockRepo.getSavedViewById.mockResolvedValue(existing);

    await expect(
      service.toggleFavourite(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, []),
    ).rejects.toThrow(ViewScopeForbiddenError);
  });

  it('throws ViewNotFoundError when view does not exist', async () => {
    mockRepo.getSavedViewById.mockResolvedValue(null);

    await expect(
      service.toggleFavourite(TEST_COMPANY_ID, 'nonexistent', TEST_USER_ID, []),
    ).rejects.toThrow(ViewNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// setDefault
// ---------------------------------------------------------------------------

describe('setDefault', () => {
  it('calls repo.setDefault with correct arguments', async () => {
    const existing = sampleSavedView({ dataViewId: DATA_VIEW_ID, createdBy: TEST_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.setDefault.mockResolvedValue(undefined);

    await service.setDefault(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'STAFF');

    expect(mockRepo.setDefault).toHaveBeenCalledWith(
      SAVED_VIEW_ID,
      TEST_COMPANY_ID,
      DATA_VIEW_ID,
      TEST_USER_ID,
      'PERSONAL',
    );
  });

  it('allows ADMIN to set default on other user view', async () => {
    const existing = sampleSavedView({ dataViewId: DATA_VIEW_ID, createdBy: OTHER_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);
    mockRepo.setDefault.mockResolvedValue(undefined);

    await service.setDefault(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'ADMIN');

    expect(mockRepo.setDefault).toHaveBeenCalledWith(
      SAVED_VIEW_ID,
      TEST_COMPANY_ID,
      DATA_VIEW_ID,
      TEST_USER_ID,
      'PERSONAL',
    );
  });

  it('rejects non-owner non-admin setDefault', async () => {
    const existing = sampleSavedView({ dataViewId: DATA_VIEW_ID, createdBy: OTHER_USER_ID });
    mockRepo.getSavedViewById.mockResolvedValue(existing);

    await expect(
      service.setDefault(TEST_COMPANY_ID, SAVED_VIEW_ID, TEST_USER_ID, 'STAFF'),
    ).rejects.toThrow(ViewScopeForbiddenError);
  });

  it('throws ViewNotFoundError when view does not exist', async () => {
    mockRepo.getSavedViewById.mockResolvedValue(null);

    await expect(
      service.setDefault(TEST_COMPANY_ID, 'nonexistent', TEST_USER_ID, 'STAFF'),
    ).rejects.toThrow(ViewNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// getFavourites
// ---------------------------------------------------------------------------

describe('getFavourites', () => {
  it('returns favourited views as DTOs', async () => {
    const fav = sampleSavedView({ isFavourite: true, dataView: { viewKey: 'USERS' } });
    mockRepo.getFavourites.mockResolvedValue([fav]);

    const result = await service.getFavourites(TEST_COMPANY_ID, TEST_USER_ID, [ROLE_ID_1]);

    expect(result).toHaveLength(1);
    expect(result[0]!.isFavourite).toBe(true);
    expect(result[0]!.conditions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveColumnPreferences
// ---------------------------------------------------------------------------

describe('saveColumnPreferences', () => {
  it('resolves data view and upserts column preferences', async () => {
    const dataView = sampleDataViewWithFields();
    mockRepo.getDataViewWithFields.mockResolvedValue(dataView);
    mockRepo.upsertColumnPreferences.mockResolvedValue(undefined);

    const prefs = [
      {
        dataViewFieldId: FIELD_ID_1,
        visible: true,
        displayOrder: 0,
        width: 200,
        pinned: 'NONE' as const,
      },
    ];

    await service.saveColumnPreferences(TEST_USER_ID, 'USERS', TEST_COMPANY_ID, prefs);

    expect(mockRepo.upsertColumnPreferences).toHaveBeenCalledWith(
      TEST_USER_ID,
      [FIELD_ID_1, FIELD_ID_2],
      prefs,
    );
  });

  it('throws ViewNotFoundError when viewKey does not exist', async () => {
    mockRepo.getDataViewWithFields.mockResolvedValue(null);

    await expect(
      service.saveColumnPreferences(TEST_USER_ID, 'NONEXISTENT', TEST_COMPANY_ID, []),
    ).rejects.toThrow(ViewNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// updateColumnWidth
// ---------------------------------------------------------------------------

describe('updateColumnWidth', () => {
  it('validates field belongs to view and delegates to repository', async () => {
    // Simulate Redis cache hit with valid metadata
    const cachedMetadata = {
      dataView: {
        id: DATA_VIEW_ID,
        viewKey: 'USERS',
        viewName: 'Users',
        entityTable: 'User',
        idField: 'id',
        defaultSortField: 'createdAt',
        defaultSortDir: 'DESC',
      },
      fields: [
        {
          id: FIELD_ID_1,
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
        },
      ],
      datePresets: [],
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedMetadata));
    mockRepo.updateColumnWidth.mockResolvedValue(undefined);

    await service.updateColumnWidth(TEST_COMPANY_ID, TEST_USER_ID, 'USERS', FIELD_ID_1, 300);

    expect(mockRepo.updateColumnWidth).toHaveBeenCalledWith(TEST_USER_ID, FIELD_ID_1, 300, 1);
  });

  it('throws ViewNotFoundError when field not in view', async () => {
    const cachedMetadata = {
      dataView: {
        id: DATA_VIEW_ID,
        viewKey: 'USERS',
        viewName: 'Users',
        entityTable: 'User',
        idField: 'id',
        defaultSortField: 'createdAt',
        defaultSortDir: 'DESC',
      },
      fields: [
        {
          id: FIELD_ID_1,
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
        },
      ],
      datePresets: [],
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedMetadata));

    await expect(
      service.updateColumnWidth(TEST_COMPANY_ID, TEST_USER_ID, 'USERS', 'nonexistent-field', 300),
    ).rejects.toThrow(ViewNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// invalidateMetadataCache
// ---------------------------------------------------------------------------

describe('invalidateMetadataCache', () => {
  it('deletes the cache key', async () => {
    mockRedis.del.mockResolvedValue(1);

    await service.invalidateMetadataCache(TEST_COMPANY_ID, 'USERS');

    expect(mockRedis.del).toHaveBeenCalledWith(CACHE_KEY_USERS);
  });
});
