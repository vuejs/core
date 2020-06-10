const DOMGlobals = ['window', 'document']
const NodeGlobals = ['module', 'require']

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module'
  },
  rules: {
    // most of the codebase are expected to be env agnostic
    'no-restricted-globals': ['error', ...DOMGlobals, ...NodeGlobals],
    // since we target ES2015 for baseline support, we need to forbid object
    // rest spread usage (both assign and destructure)
    'no-restricted-syntax': [
      'error',
      'ObjectExpression > SpreadElement',
      'ObjectPattern > RestElement'
    ]
  },
  overrides: [
    // Packages targeting DOM
    {
      files: ['packages/{vue,runtime-dom}/**'],
      rules: {
        'no-restricted-globals': ['error', ...NodeGlobals]
      }
    },
    // Packages targeting Node
    {
      files: ['packages/{compiler-sfc,compiler-ssr,server-renderer}/**'],
      rules: {
        'no-restricted-globals': ['error', ...DOMGlobals],
        'no-restricted-syntax': 'off'
      }
    },
    // Private package, no syntax restrictions
    {
      files: ['packages/template-explorer/**'],
      rules: {
        'no-restricted-globals': ['error', ...NodeGlobals],
        'no-restricted-syntax': 'off'
      }
    }
  ]
}
