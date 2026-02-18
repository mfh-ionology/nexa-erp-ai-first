import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

/** Base naming convention selectors shared across all configs. */
export const baseNamingConvention = [
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
  { selector: 'function', format: ['camelCase'] },
  { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['UPPER_CASE'] },
  { selector: 'property', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
  { selector: 'classMethod', format: ['camelCase'] },
  { selector: 'import', format: null },
];

/**
 * Shared ESLint base configuration for all Nexa ERP packages.
 * Uses ESLint v9 flat config format with typescript-eslint strictTypeChecked rules.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir - Absolute path to the package root (use import.meta.dirname)
 * @returns {import("eslint").Linter.Config[]}
 */
export function createBaseConfig({ tsconfigRootDir }) {
  return [
    // Global ignores (replaces .eslintignore)
    {
      ignores: [
        '**/dist/**',
        '**/node_modules/**',
        '**/.turbo/**',
        '**/coverage/**',
        '**/*.generated.*',
        '**/prisma/generated/**',
      ],
    },

    // Base JS recommended rules
    eslint.configs.recommended,

    // TypeScript strict + type-checked rules (leverages projectService configured below)
    ...tseslint.configs.strictTypeChecked,

    // TypeScript + project-specific configuration
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
        globals: {
          ...globals.es2022,
        },
      },
      plugins: {
        '@typescript-eslint': tseslint.plugin,
      },
      rules: {
        // --- HARD enforcement from Architecture anti-patterns ---

        // No `any` type — use `unknown` and narrow
        '@typescript-eslint/no-explicit-any': 'error',

        // No console.log — use structured Pino logger (warn/error allowed for startup diagnostics)
        'no-console': ['error', { allow: ['warn', 'error'] }],

        // Enforce `import type` for type-only imports
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
            fixStyle: 'separate-type-imports',
          },
        ],

        // No unused variables (with _ prefix exception)
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],

        // Disable base rule in favour of TS version
        'no-unused-vars': 'off',

        // --- Naming conventions from Architecture ---
        '@typescript-eslint/naming-convention': ['error', ...baseNamingConvention],

        // --- Additional strict rules ---
        '@typescript-eslint/no-non-null-assertion': 'warn',
        'no-restricted-syntax': [
          'error',
          {
            selector: 'TSEnumDeclaration',
            message:
              'Enums are not allowed. Use union types instead (e.g., type Status = "active" | "inactive"). const enums are incompatible with isolatedModules (Vite/esbuild).',
          },
        ],
        eqeqeq: ['error', 'always'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'prefer-const': 'error',
        'no-var': 'error',
      },
    },

    // JS files configuration (config files, etc.) — disable type-checked rules
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: {
        globals: {
          ...globals.es2022,
        },
      },
      rules: {
        ...tseslint.configs.disableTypeChecked.rules,
        // Relax TypeScript-specific rules for plain JS files
        '@typescript-eslint/no-require-imports': 'off',
      },
    },

    // Prettier — must be last to disable conflicting formatting rules
    prettierConfig,
  ];
}
