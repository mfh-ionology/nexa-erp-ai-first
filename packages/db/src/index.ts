// @nexa/db — Database layer (Prisma ORM)

// Singleton client
export { prisma, PrismaClient } from './client';

// Prisma namespace (for PrismaClientKnownRequestError, etc.)
export { Prisma } from '../generated/prisma/client';

// Model types (re-exported for consumer convenience)
export type {
  Currency,
  Country,
  CompanyProfile,
  ExchangeRate,
  Department,
  PaymentTerms,
  VatCode,
  Tag,
  BankHoliday,
  SystemSetting,
  RegisterSharingRule,
  UserCompanyRole,
  User,
  RefreshToken,
  NumberSeries,
  Resource,
  AccessGroup,
  AccessGroupPermission,
  AccessGroupFieldOverride,
  UserAccessGroup,
  AuditLog,
  AiModel,
  AiPrompt,
  AiPromptVersion,
  AiAgent,
  AiSkill,
  AiConversation,
  AiMessage,
  AiFeedback,
  AiUsage,
  AiEval,
  DataView,
  DataViewField,
  DateRangePreset,
  UserColumnPreference,
  SavedView,
  SavedViewCondition,
  Attachment,
  Note,
  AiAutomation,
  AiAutomationStep,
  AiAutomationSchedule,
  AiAutomationRun,
  AiAutomationStepRun,
  AiPromptVariable,
  RecordLink,
  NotificationTemplate,
  NotificationPreference,
  NotificationRoleDefault,
  Notification,
} from '../generated/prisma/client';

// Enums
export {
  VatType,
  VatScheme,
  ExchangeRateSource,
  TagType,
  HolidayType,
  SettingCategory,
  SettingValueType,
  SharingMode,
  UserRole,
  ViewScope,
  ResourceType,
  FieldVisibility,
  FieldDataType,
  LovType,
  PinPosition,
  FilterOperator,
  NoteType,
  RecordLinkType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
} from '../generated/prisma/client';

// Utilities
export { getVisibleCompanyIds } from './utils/sharing';
export { resolveUserRole } from './utils/rbac';

// Services
export type { TransactionClient } from './services/number-series.service';
export {
  nextNumber,
  NumberSeriesError,
  NumberSeriesNotFoundError,
  NumberSeriesInactiveError,
} from './services/number-series.service';

export {
  loadDefaultResources,
  loadDefaultAccessGroups,
  assignFullAccessGroup,
} from './services/default-data-loader.service';
