/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    // Resolve @/ path alias to src/
    '^@/(.*)$': '<rootDir>/src/$1',
    // Resolve workspace packages
    '^@nexa/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
    '^@nexa/i18n$': '<rootDir>/../../packages/i18n/src/index.ts',
    '^@nexa/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@nexa/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  transformIgnorePatterns: [
    // pnpm hoists to .pnpm/<pkg>/node_modules/<actual-pkg> — handle both flat and nested paths
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:(?:jest-)?react-native|@react-native(?:-community)?|expo(?:nent)?|@expo(?:nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|zustand))',
  ],
};
