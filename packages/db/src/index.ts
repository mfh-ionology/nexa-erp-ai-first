// @nexa/db — Database layer (Prisma ORM)

// Singleton client
export { prisma, PrismaClient } from './client';

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
} from '../generated/prisma/client';

// Utilities
export { getVisibleCompanyIds } from './utils/sharing';
export { resolveUserRole } from './utils/rbac';

// Services
export {
  nextNumber,
  NumberSeriesError,
  NumberSeriesNotFoundError,
  NumberSeriesInactiveError,
} from './services/number-series.service';
