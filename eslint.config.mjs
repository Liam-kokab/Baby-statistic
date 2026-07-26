// @ts-check
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'server/public/**'] },
  ...tseslint.configs.recommended,
  {
    // Codebase convention: prefix intentionally-unused params/vars with `_` (e.g. `_req`, `_next`, `_e`).
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['client/src/**/*.{ts,tsx}'],
    extends: [reactPlugin.configs.flat.recommended, reactPlugin.configs.flat['jsx-runtime']],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      // These two rules (from the newer React Compiler-oriented ruleset) are downgraded to
      // warnings: this codebase intentionally and pervasively uses `useEffect(() => { load(); }, [load])`
      // to fetch data on mount (a valid "synchronize with an external system" effect per React's own
      // docs), and computes small derived values (e.g. `Date.now() - x`) directly in the render body.
      // They also false-positive on plain event handlers (e.g. `handleMarkTaken`) that the rule
      // mistakes for render-time calls. Kept as warnings (not silenced) so genuinely new issues stay visible.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    files: ['server/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Root-level PM2/Node config scripts — plain CommonJS, run directly by `node`/`pm2` (no build step).
    files: ['ecosystem.config.js', 'healthcheck.js'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);

