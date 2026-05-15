// @ts-check
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
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
  }
);

