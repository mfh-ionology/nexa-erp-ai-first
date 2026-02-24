/**
 * Jest test setup for the Nexa mobile app.
 *
 * Mocks native modules that are unavailable in the Jest environment:
 * - expo-secure-store (in-memory key-value store)
 * - expo-local-authentication (configurable biometric results)
 * - expo-notifications (mock push token)
 * - @nexa/i18n (returns translation key as value)
 * - react-native-reanimated (required for gesture/animation libraries)
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// --- Shared mock state via global ---
// Using global ensures setupFiles and test file imports share the same state.

interface MockState {
  secureStoreData: Record<string, string>;
  biometric: {
    hardwareAvailable: boolean;
    enrolled: boolean;
    authSuccess: boolean;
  };
}

const mockState: MockState = {
  secureStoreData: {},
  biometric: {
    hardwareAvailable: true,
    enrolled: true,
    authSuccess: true,
  },
};

(global as Record<string, unknown>).__nexaMockState = mockState;

// --- expo-secure-store (in-memory implementation) ---

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    const state = (global as Record<string, unknown>).__nexaMockState as MockState;
    state.secureStoreData[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => {
    const state = (global as Record<string, unknown>).__nexaMockState as MockState;
    return state.secureStoreData[key] ?? null;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    const state = (global as Record<string, unknown>).__nexaMockState as MockState;
    delete state.secureStoreData[key];
  }),
}));

// --- expo-local-authentication (configurable results) ---

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => {
    const state = (global as Record<string, unknown>).__nexaMockState as MockState;
    return state.biometric.hardwareAvailable;
  }),
  isEnrolledAsync: jest.fn(async () => {
    const state = (global as Record<string, unknown>).__nexaMockState as MockState;
    return state.biometric.enrolled;
  }),
  authenticateAsync: jest.fn(async () => {
    const state = (global as Record<string, unknown>).__nexaMockState as MockState;
    return {
      success: state.biometric.authSuccess,
      error: state.biometric.authSuccess ? undefined : 'user_cancel',
    };
  }),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC: 2 },
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

// --- expo-notifications (mock push token) ---

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({
    data: 'ExponentPushToken[mock-token-123]',
  })),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  removeNotificationSubscription: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

// --- expo-device ---

jest.mock('expo-device', () => ({
  isDevice: true,
  modelId: 'iPhone15,2',
  modelName: 'iPhone 14 Pro',
  osName: 'iOS',
}));

// --- @nexa/i18n (return translation key as value) ---

const mockT = jest.fn((key: string) => key);

jest.mock('@nexa/i18n', () => ({
  i18n: {
    language: 'en',
    t: mockT,
    changeLanguage: jest.fn(),
    use: jest.fn(() => ({ init: jest.fn() })),
  },
  useTranslation: jest.fn(() => ({
    t: mockT,
    i18n: { language: 'en', changeLanguage: jest.fn() },
  })),
  useI18n: jest.fn(() => ({
    t: mockT,
    locale: 'en',
    changeLocale: jest.fn(),
  })),
  useLocale: jest.fn(() => 'en'),
  I18nProvider: ({ children }: { children: unknown }) => children,
  DEFAULT_LOCALE: 'en',
  DEFAULT_NAMESPACE: 'common',
  SUPPORTED_LOCALES: ['en'],
  TRANSLATION_NAMESPACES: ['common', 'validation', 'navigation', 'errors', 'mobile'],
  isSupportedLocale: jest.fn(() => true),
  matchSupportedLocale: jest.fn(() => 'en'),
  resolveLocale: jest.fn(() => 'en'),
  buildInitOptions: jest.fn(),
  createI18nInstance: jest.fn(),
  i18nReady: Promise.resolve(),
  mapZodIssueToTranslationKey: jest.fn(() => 'validation.unknown'),
  useFormatCurrency: jest.fn(() => jest.fn((v: string) => `$${v}`)),
  useFormatNumber: jest.fn(() => jest.fn((v: number) => String(v))),
  useFormatDate: jest.fn(() => jest.fn((v: string) => v)),
  useFormatDateTime: jest.fn(() => jest.fn((v: string) => v)),
  useFormatPercent: jest.fn(() => jest.fn((v: number) => `${String(v)}%`)),
}));

// --- react-native-reanimated ---

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// --- expo-router ---

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  })),
  useSegments: jest.fn(() => []),
  usePathname: jest.fn(() => '/'),
  Redirect: jest.fn(() => null),
  Tabs: jest.fn(({ children }: { children: unknown }) => children),
  Stack: jest.fn(({ children }: { children: unknown }) => children),
  Slot: jest.fn(() => null),
}));

// --- Silence console.warn/error noise from React Native internals in tests ---

const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('Reanimated') || msg.includes('NativeEventEmitter')) return;
  originalWarn(...args);
};

console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('Reanimated') || msg.includes('NativeEventEmitter')) return;
  originalError(...args);
};

// --- Exported helpers for test files ---

/** Access the shared mock SecureStore data. */
export function getMockSecureStoreData(): Record<string, string> {
  return ((global as Record<string, unknown>).__nexaMockState as MockState)
    .secureStoreData;
}

/** Clear all mock SecureStore data. */
export function clearMockSecureStore(): void {
  const data = getMockSecureStoreData();
  for (const key of Object.keys(data)) {
    delete data[key];
  }
}

/** Set a value in the mock SecureStore. */
export function setMockSecureStoreValue(key: string, value: string): void {
  getMockSecureStoreData()[key] = value;
}

/** Configure biometric mock behavior. */
export function setBiometricHardwareAvailable(available: boolean): void {
  ((global as Record<string, unknown>).__nexaMockState as MockState).biometric.hardwareAvailable = available;
}
export function setBiometricEnrolled(enrolled: boolean): void {
  ((global as Record<string, unknown>).__nexaMockState as MockState).biometric.enrolled = enrolled;
}
export function setBiometricAuthSuccess(success: boolean): void {
  ((global as Record<string, unknown>).__nexaMockState as MockState).biometric.authSuccess = success;
}

/** Reset all mock state to defaults. */
export function resetMockState(): void {
  const state = (global as Record<string, unknown>).__nexaMockState as MockState;
  // Clear SecureStore
  for (const key of Object.keys(state.secureStoreData)) {
    delete state.secureStoreData[key];
  }
  // Reset biometric defaults
  state.biometric.hardwareAvailable = true;
  state.biometric.enrolled = true;
  state.biometric.authSuccess = true;
}
