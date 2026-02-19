import { createNodeConfig } from '@nexa/config/eslint/node';

const config = createNodeConfig({ tsconfigRootDir: import.meta.dirname });

// vitest.config.ts is outside tsconfig.json's "include: ['src']" scope.
// Enable allowDefaultProject so the TypeScript project service can lint it.
for (const block of config) {
  const ps = block.languageOptions?.parserOptions?.projectService;
  if (ps === true) {
    block.languageOptions.parserOptions.projectService = {
      allowDefaultProject: ['vitest.config.ts'],
    };
  }
}

export default config;
