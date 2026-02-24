// Core client
export { ApiClient } from './client';

// Error classes
export {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} from './errors';

// Types
export type {
  TokenPair,
  ApiClientConfig,
  RequestOptions,
  ApiMeta,
  ApiResult,
} from './types';

// Endpoint types
export type {
  AuthEndpoints,
  LoginUser,
  LoginResponse,
  SystemEndpoints,
  ModulePermission,
  ApiResolvedPermissions,
  Company,
  AiEndpoints,
  BriefingItem,
  BriefingResponse,
  ChatSession,
  ChatMessage,
  ChatHistoryResponse,
  NotificationEndpoints,
  Notification,
  NotificationListResponse,
  NotificationPreferences,
  RegisterDevicePayload,
} from './endpoints';
