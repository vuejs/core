/* eslint-disable no-restricted-globals */

const { builtinModules } = require('node:module')
const DOMGlobals = ['window', 'document']
const NodeGlobals = ['module', 'require']

const banConstEnum = {
  selector: 'TSEnumDeclaration[const=true]',
  message:
    'Please use non-const enums. This project automatically inlines enums.'
}

/**
 * @type {import('eslint-define-config').ESLintConfig}
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module'
  },
  plugins: ['jest', 'import', '@typescript-eslint'],
  rules: {
    'no-debugger': 'error',
    // most of the codebase are expected to be env agnostic
    'no-restricted-globals': ['error', ...DOMGlobals, ...NodeGlobals],

    'no-restricted-syntax': [
      'error',
      banConstEnum,
      // since we target ES2015 for baseline support, we need to forbid object
      // rest spread usage in destructure as it compiles into a verbose helper.
      'ObjectPattern > RestElement',
      // tsc compiles assignment spread into Object.assign() calls, but esbuild
      // still generates verbose helpers, so spread assignment is also prohiboted
      'ObjectExpression > SpreadElement',
      'AwaitExpression'
    ],
    'sort-imports': ['error', { ignoreDeclarationSort: true }],

    'import/no-nodejs-modules': [
      'error',
      { allow: builtinModules.map(mod => `node:${mod}`) }
    ],
    // This rule enforces the preference for using '@ts-expect-error' comments in TypeScript
    // code to indicate intentional type errors, improving code clarity and maintainability.
    '@typescript-eslint/prefer-ts-expect-error': 'error',
    // Enforce the use of 'import type' for importing types
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        fixStyle: 'inline-type-imports',
        disallowTypeAnnotations: false
      },
    ],
    // Enforce the use of top-level import type qualifier when an import only has specifiers with inline type qualifiers
    '@typescript-eslint/no-import-type-side-effects': 'error'
  },
  overrides: [
    // tests, no restrictions (runs in Node / jest with jsdom)
    {
      files: ['**/__tests__/**', 'packages/dts-test/**'],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-syntax': 'off',
        'jest/no-disabled-tests': 'error',
        'jest/no-focused-tests': 'error'
      }
    },
    // shared, may be used in any env
    {
      files: ['packages/shared/**'],
      rules: {
        'no-restricted-globals': 'off'
      }
    },
    // Packages targeting DOM
    {
      files: ['packages/{vue,vue-compat,runtime-dom}/**'],
      rules: {
        'no-restricted-globals': ['error', ...NodeGlobals]
      }
    },
    // Packages targeting Node
    {
      files: ['packages/{compiler-sfc,compiler-ssr,server-renderer}/**'],
      rules: {
        'no-restricted-globals': ['error', ...DOMGlobals],
        'no-restricted-syntax': ['error', banConstEnum]
      }
    },
    // Private package, browser only + no syntax restrictions
    {
      files: ['packages/template-explorer/**', 'packages/sfc-playground/**'],
      rules: {
        'no-restricted-globals': ['error', ...NodeGlobals],
        'no-restricted-syntax': ['error', banConstEnum]
      }
    },
    // JavaScript files
    {
      files: ['*.js', '*.cjs'],
      rules: {
        // We only do `no-unused-vars` checks for js files, TS files are checked by TypeScript itself.
        'no-unused-vars': ['error', { vars: 'all', args: 'none' }]
      }
    },
    // Node scripts
    {
      files: ['scripts/**', '*.{js,ts}', 'packages/**/index.js'],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-syntax': ['error', banConstEnum]
      }
    },
    // Import nodejs modules in compiler-sfc
    {
      files: ['packages/compiler-sfc/**'],
      rules: {
        'import/no-nodejs-modules': ['error', { allow: builtinModules }]
      }
    },
  ]
}
