import importX from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'
import vitest from 'eslint-plugin-vitest'
import { builtinModules } from 'node:module'

const DOMGlobals = ['window', 'document']
const NodeGlobals = ['module', 'require']

const banConstEnum = {
  selector: 'TSEnumDeclaration[const=true]',
  message:
    'Please use non-const enums. This project automatically inlines enums.',
}

export default tseslint.config(
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.base],
    plugins: {
      'import-x': importX,
    },
    rules: {
      'no-debugger': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      // most of the codebase are expected to be env agnostic
      'no-restricted-globals': ['error', ...DOMGlobals, ...NodeGlobals],

      'no-restricted-syntax': [
        'error',
        banConstEnum,
        {
          selector: 'ObjectPattern > RestElement',
          message:
            'Our output target is ES2016, and object rest spread results in ' +
            'verbose helpers and should be avoided.',
        },
        {
          selector: 'ObjectExpression > SpreadElement',
          message:
            'esbuild transpiles object spread into very verbose inline helpers.\n' +
            'Please use the `extend` helper from @vue/shared instead.',
        },
        {
          selector: 'AwaitExpression',
          message:
            'Our output target is ES2016, so async/await syntax should be avoided.',
        },
      ],
      'sort-imports': ['error', { ignoreDeclarationSort: true }],

      'import-x/no-nodejs-modules': [
        'error',
        { allow: builtinModules.map(mod => `node:${mod}`) },
      ],
      // This rule enforces the preference for using '@ts-expect-error' comments in TypeScript
      // code to indicate intentional type errors, improving code clarity and maintainability.
      '@typescript-eslint/prefer-ts-expect-error': 'error',
      // Enforce the use of 'import type' for importing types
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      // Enforce the use of top-level import type qualifier when an import only has specifiers with inline type qualifiers
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },

  // tests, no restrictions (runs in Node / Vitest with jsdom)
  {
    files: ['**/__tests__/**', 'packages/dts-test/**'],
    plugins: { vitest },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      'no-console': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
    },
  },

  // shared, may be used in any env
  {
    files: ['packages/shared/**', 'eslint.config.js'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // Packages targeting DOM
  {
    files: ['packages/{vue,vue-compat,runtime-dom}/**'],
    rules: {
      'no-restricted-globals': ['error', ...NodeGlobals],
    },
  },

  // Packages targeting Node
  {
    files: ['packages/{compiler-sfc,compiler-ssr,server-renderer}/**'],
    rules: {
      'no-restricted-globals': ['error', ...DOMGlobals],
      'no-restricted-syntax': ['error', banConstEnum],
    },
  },

  // Private package, browser only + no syntax restrictions
  {
    files: ['packages/template-explorer/**', 'packages/sfc-playground/**'],
    rules: {
      'no-restricted-globals': ['error', ...NodeGlobals],
      'no-restricted-syntax': ['error', banConstEnum],
      'no-console': 'off',
    },
  },

  // JavaScript files
  {
    files: ['*.js'],
    rules: {
      // We only do `no-unused-vars` checks for js files, TS files are checked by TypeScript itself.
      'no-unused-vars': ['error', { vars: 'all', args: 'none' }],
    },
  },

  // Node scripts
  {
    files: [
      'eslint.config.js',
      'rollup.config.js',
      'scripts/**',
      './*.{js,ts}',
      'packages/*/*.js',
      'packages/vue/*/*.js',
    ],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': ['error', banConstEnum],
      'no-console': 'off',
    },
  },

  // Import nodejs modules in compiler-sfc
  {
    files: ['packages/compiler-sfc/src/**'],
    rules: {
      'import-x/no-nodejs-modules': ['error', { allow: builtinModules }],
    },
  },

  {
    ignores: [
      '**/dist/',
      '**/temp/',
      '**/coverage/',
      '.idea/',
      'explorations/',
      'dts-build/packages',
    ],
  },
)
