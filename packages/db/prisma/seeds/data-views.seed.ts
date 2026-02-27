/* eslint-disable @typescript-eslint/naming-convention -- Prisma compound keys use snake_case */
/* eslint-disable no-console -- seed scripts use console for progress logging */
import type { PrismaClient } from '../../generated/prisma/client';
import { FieldDataType, LovType } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// Date Range Presets (20 records)
// ---------------------------------------------------------------------------

const DATE_RANGE_PRESETS = [
  { presetKey: 'custom', presetName: 'Custom Range', orderInList: 0 },
  { presetKey: 'today', presetName: 'Today', orderInList: 1 },
  { presetKey: 'yesterday', presetName: 'Yesterday', orderInList: 2 },
  { presetKey: 'tomorrow', presetName: 'Tomorrow', orderInList: 3 },
  { presetKey: 'last3days', presetName: 'Last 3 Days', orderInList: 4 },
  { presetKey: 'last7days', presetName: 'Last 7 Days', orderInList: 5 },
  { presetKey: 'last30days', presetName: 'Last 30 Days', orderInList: 6 },
  { presetKey: 'next7days', presetName: 'Next 7 Days', orderInList: 7 },
  { presetKey: 'next30days', presetName: 'Next 30 Days', orderInList: 8 },
  { presetKey: 'thisweek', presetName: 'This Week', orderInList: 9 },
  { presetKey: 'lastweek', presetName: 'Last Week', orderInList: 10 },
  { presetKey: 'nextweek', presetName: 'Next Week', orderInList: 11 },
  { presetKey: 'thismonth', presetName: 'This Month', orderInList: 12 },
  { presetKey: 'lastmonth', presetName: 'Last Month', orderInList: 13 },
  { presetKey: 'nextmonth', presetName: 'Next Month', orderInList: 14 },
  { presetKey: 'thisyear', presetName: 'This Year', orderInList: 15 },
  { presetKey: 'lastyear', presetName: 'Last Year', orderInList: 16 },
  { presetKey: 'nextyear', presetName: 'Next Year', orderInList: 17 },
  { presetKey: 'mtd', presetName: 'Month to Date', orderInList: 18 },
  { presetKey: 'ytd', presetName: 'Year to Date', orderInList: 19 },
];

// ---------------------------------------------------------------------------
// USERS DataView — reference implementation
// ---------------------------------------------------------------------------

const USERS_VIEW = {
  viewKey: 'USERS',
  viewName: 'Users',
  entityTable: 'User',
  idField: 'id',
  defaultSortField: 'createdAt',
  defaultSortDir: 'DESC',
};

const USERS_FIELDS = [
  {
    fieldKey: 'email',
    fieldLabel: 'Email',
    fieldType: FieldDataType.STRING,
    defaultVisible: true,
    defaultOrder: 1,
    defaultWidth: 250,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: LovType.NONE,
    lovSearchMin: 0,
  },
  {
    fieldKey: 'firstName',
    fieldLabel: 'First Name',
    fieldType: FieldDataType.STRING,
    defaultVisible: true,
    defaultOrder: 2,
    defaultWidth: 150,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: LovType.NONE,
    lovSearchMin: 0,
  },
  {
    fieldKey: 'lastName',
    fieldLabel: 'Last Name',
    fieldType: FieldDataType.STRING,
    defaultVisible: true,
    defaultOrder: 3,
    defaultWidth: 150,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: LovType.NONE,
    lovSearchMin: 0,
  },
  {
    fieldKey: 'role',
    fieldLabel: 'Role',
    fieldType: FieldDataType.ENUM,
    defaultVisible: true,
    defaultOrder: 4,
    defaultWidth: 120,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: LovType.STATIC,
    lovStaticValues: [
      { value: 'SUPER_ADMIN', label: 'Super Admin' },
      { value: 'ADMIN', label: 'Admin' },
      { value: 'MANAGER', label: 'Manager' },
      { value: 'STAFF', label: 'Staff' },
      { value: 'VIEWER', label: 'Viewer' },
    ],
    lovSearchMin: 0,
  },
  {
    fieldKey: 'isActive',
    fieldLabel: 'Active',
    fieldType: FieldDataType.BOOLEAN,
    defaultVisible: true,
    defaultOrder: 5,
    defaultWidth: 100,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: LovType.STATIC,
    lovStaticValues: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' },
    ],
    lovSearchMin: 0,
  },
  {
    fieldKey: 'createdAt',
    fieldLabel: 'Created',
    fieldType: FieldDataType.DATE,
    defaultVisible: true,
    defaultOrder: 6,
    defaultWidth: 150,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: LovType.NONE,
    lovSearchMin: 0,
  },
  {
    fieldKey: 'lastLoginAt',
    fieldLabel: 'Last Login',
    fieldType: FieldDataType.DATE,
    defaultVisible: false,
    defaultOrder: 7,
    defaultWidth: 150,
    sortable: true,
    filterable: true,
    advancedFilterOnly: false,
    pinnable: true,
    lovType: LovType.NONE,
    lovSearchMin: 0,
  },
];

// ---------------------------------------------------------------------------
// Seed Function
// ---------------------------------------------------------------------------

export async function seedDataViews(prisma: PrismaClient, companyId: string): Promise<void> {
  // 1. Seed DateRangePresets (idempotent via upsert on [companyId, presetKey])
  for (const preset of DATE_RANGE_PRESETS) {
    await prisma.dateRangePreset.upsert({
      where: {
        companyId_presetKey: {
          companyId,
          presetKey: preset.presetKey,
        },
      },
      update: {
        presetName: preset.presetName,
        orderInList: preset.orderInList,
        isActive: true,
      },
      create: {
        companyId,
        presetKey: preset.presetKey,
        presetName: preset.presetName,
        orderInList: preset.orderInList,
      },
    });
  }
  console.log(`Seeded ${String(DATE_RANGE_PRESETS.length)} date range presets`);

  // 2. Seed USERS DataView (idempotent via upsert on [companyId, viewKey])
  const dataView = await prisma.dataView.upsert({
    where: {
      companyId_viewKey: {
        companyId,
        viewKey: USERS_VIEW.viewKey,
      },
    },
    update: {
      viewName: USERS_VIEW.viewName,
      entityTable: USERS_VIEW.entityTable,
      idField: USERS_VIEW.idField,
      defaultSortField: USERS_VIEW.defaultSortField,
      defaultSortDir: USERS_VIEW.defaultSortDir,
      isActive: true,
    },
    create: {
      companyId,
      viewKey: USERS_VIEW.viewKey,
      viewName: USERS_VIEW.viewName,
      entityTable: USERS_VIEW.entityTable,
      idField: USERS_VIEW.idField,
      defaultSortField: USERS_VIEW.defaultSortField,
      defaultSortDir: USERS_VIEW.defaultSortDir,
    },
  });
  console.log(`Seeded DataView: ${USERS_VIEW.viewKey}`);

  // 3. Seed DataViewFields for USERS (idempotent via upsert on [dataViewId, fieldKey])
  for (const field of USERS_FIELDS) {
    await prisma.dataViewField.upsert({
      where: {
        dataViewId_fieldKey: {
          dataViewId: dataView.id,
          fieldKey: field.fieldKey,
        },
      },
      update: {
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        defaultVisible: field.defaultVisible,
        defaultOrder: field.defaultOrder,
        defaultWidth: field.defaultWidth,
        sortable: field.sortable,
        filterable: field.filterable,
        advancedFilterOnly: field.advancedFilterOnly,
        pinnable: field.pinnable,
        lovType: field.lovType,
        lovSearchMin: field.lovSearchMin,
        ...('lovStaticValues' in field ? { lovStaticValues: field.lovStaticValues } : {}),
        isActive: true,
      },
      create: {
        dataViewId: dataView.id,
        ...field,
      },
    });
  }
  console.log(`Seeded ${String(USERS_FIELDS.length)} fields for DataView: ${USERS_VIEW.viewKey}`);
}
