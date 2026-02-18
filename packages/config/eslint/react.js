import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import { createBaseConfig, baseNamingConvention } from './base.js';

/**
 * ESLint configuration for React packages (apps/web, apps/mobile, apps/platform-admin).
 * Extends base config with React, React Hooks, and jsx-a11y rules.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir - Absolute path to the package root (use import.meta.dirname)
 * @returns {import("eslint").Linter.Config[]}
 */
export function createReactConfig({ tsconfigRootDir }) {
  return [
    ...createBaseConfig({ tsconfigRootDir }),

    // React flat config
    reactPlugin.configs.flat['jsx-runtime'],

    // React Hooks
    reactHooksPlugin.configs.flat['recommended-latest'],

    // jsx-a11y strict (WCAG 2.1 AA — NFR27, GAP-1)
    jsxA11yPlugin.flatConfigs.strict,

    // React-specific overrides
    {
      files: ['**/*.tsx', '**/*.jsx'],
      languageOptions: {
        globals: {
          ...globals.browser,
        },
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        // Extend base naming conventions with PascalCase for React components
        '@typescript-eslint/naming-convention': [
          'error',
          ...baseNamingConvention.map((entry) => {
            if (entry.selector === 'variable') {
              return { ...entry, format: ['camelCase', 'UPPER_CASE', 'PascalCase'] };
            }
            if (entry.selector === 'function') {
              return { ...entry, format: ['camelCase', 'PascalCase'] };
            }
            return entry;
          }),
        ],

        // React-specific rules
        'react/prop-types': 'off', // TypeScript handles prop validation
        'react/display-name': 'off',
        'react/jsx-no-target-blank': 'error',
        'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
      },
    },
  ];
}
