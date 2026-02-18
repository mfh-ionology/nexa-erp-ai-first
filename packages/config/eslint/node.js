import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';
import { createBaseConfig } from './base.js';

/**
 * ESLint configuration for Node.js packages (apps/api, apps/platform-api, packages/*).
 * Extends base config with Node.js globals and rules.
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir - Absolute path to the package root (use import.meta.dirname)
 * @returns {import("eslint").Linter.Config[]}
 */
export function createNodeConfig({ tsconfigRootDir }) {
  return [
    ...createBaseConfig({ tsconfigRootDir }),

    // Node.js-specific configuration
    {
      files: ['**/*.ts', '**/*.mts', '**/*.cts'],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
      plugins: {
        n: nodePlugin,
      },
      rules: {
        // Node.js-specific rules (using eslint-plugin-n, not deprecated built-in)
        'n/no-process-exit': 'error',
      },
    },

    // JS config files (eslint.config.js, etc.)
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
    },
  ];
}
