// Root ESLint config — only used as fallback for files not covered by
// package-level configs (e.g. v0-nexa-design reference components).
// Each app/package has its own eslint.config.js that takes precedence
// when using --flag v10_config_lookup_from_file.
export default [
  {
    ignores: ['v0-nexa-design/**'],
  },
];
