// @ts-check
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * @param {Object} options
 * @param {any} options.pkg - Package.json object
 * @param {string} options.format - Build format
 * @param {string} options.target - Target package name
 * @param {boolean} options.isGlobalBuild - Whether this is a global build
 * @param {boolean} options.isBrowserESMBuild - Whether this is a browser ESM build
 * @param {boolean} options.isCompatPackage - Whether this is the compat package
 * @param {any} options.packageOptions - Package build options
 * @returns {string[]}
 */
export function resolveExternal({
  pkg,
  format,
  target,
  isGlobalBuild = false,
  isBrowserESMBuild = false,
  isCompatPackage = false,
  packageOptions = {},
}) {
  const treeShakenDeps = [
    'source-map-js',
    '@babel/parser',
    'estree-walker',
    'entities/lib/decode.js',
  ]

  // Global and browser builds inline everything
  if (isGlobalBuild || isBrowserESMBuild || isCompatPackage) {
    if (!packageOptions.enableNonBrowserBranches) {
      return treeShakenDeps
    }
  }

  // Base externals for Node/bundler builds
  let external = []

  // For CJS and ESM-bundler formats, externalize dependencies
  if (format === 'cjs' || format.includes('esm-bundler')) {
    external = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      'path',
      'url',
      'stream',
    ]
  }

  // Special handling for compiler-sfc
  if (target === 'compiler-sfc') {
    const consolidateDeps = getConsolidateDeps()
    external = [
      ...external,
      ...consolidateDeps,
      'fs',
      'vm',
      'crypto',
      'react-dom/server',
      'teacup/lib/express',
      'arc-templates/dist/es5',
      'then-pug',
      'then-jade',
    ]
  }

  // Add tree-shaken deps to suppress warnings
  if (external.length) {
    external = [...external, ...treeShakenDeps]
  }

  return external
}

/**
 * Get consolidate package dependencies
 * @returns {string[]}
 */
export function getConsolidateDeps() {
  try {
    const consolidatePkg = require('@vue/consolidate/package.json')
    return Object.keys(consolidatePkg.devDependencies || {})
  } catch {
    return []
  }
}

/**
 * Resolve compiler ignore list for CommonJS
 * @param {string} target - Target package name
 * @returns {string[]}
 */
export function resolveCJSIgnores(target) {
  if (target === 'compiler-sfc') {
    return [
      ...getConsolidateDeps(),
      'vm',
      'crypto',
      'react-dom/server',
      'teacup/lib/express',
      'arc-templates/dist/es5',
      'then-pug',
      'then-jade',
    ]
  }
  return []
}

/**
 * Resolve define/replace values for build
 * @param {Object} options
 * @param {any} options.pkg - Package.json object
 * @param {string} options.format - Build format
 * @param {string} options.target - Target package name
 * @param {boolean} options.prod - Whether this is a production build
 * @param {string} [options.version] - Version override
 * @param {string} [options.commit] - Commit hash
 * @returns {Record<string, string>}
 */
export function resolveDefines({
  pkg,
  format,
  target,
  prod,
  version,
  commit = 'dev',
}) {
  const isBundlerESMBuild = format.includes('esm-bundler')
  const isBrowserESMBuild = format.includes('esm-browser')
  const isGlobalBuild = format.includes('global')
  const isCJSBuild = format === 'cjs'
  const isCompatBuild = target === 'vue-compat' || pkg.buildOptions?.compat

  // Determine if this is a browser build
  const isBrowserBuild =
    (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
    !pkg.buildOptions?.enableNonBrowserBranches

  const defines = {
    __COMMIT__: `"${commit}"`,
    __VERSION__: `"${version || pkg.version}"`,
    __DEV__: prod ? `false` : `true`,
    __TEST__: `false`,
    __BROWSER__: String(isBrowserBuild),
    __GLOBAL__: String(isGlobalBuild),
    __ESM_BUNDLER__: String(isBundlerESMBuild),
    __ESM_BROWSER__: String(isBrowserESMBuild),
    __CJS__: String(isCJSBuild),
    __SSR__: String(!isGlobalBuild),
    __COMPAT__: String(isCompatBuild),
    __FEATURE_SUSPENSE__: `true`,
    __FEATURE_OPTIONS_API__: isBundlerESMBuild ? `__VUE_OPTIONS_API__` : `true`,
    __FEATURE_PROD_DEVTOOLS__: isBundlerESMBuild
      ? `__VUE_PROD_DEVTOOLS__`
      : `false`,
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: isBundlerESMBuild
      ? `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`
      : `false`,
  }

  return defines
}

/**
 * Resolve output format for different build types
 * @param {string} format - Build format string
 * @returns {'iife' | 'cjs' | 'esm'}
 */
export function resolveOutputFormat(format) {
  if (format.startsWith('global')) return 'iife'
  if (format === 'cjs') return 'cjs'
  return 'esm'
}

/**
 * Resolve output file postfix
 * @param {string} format - Build format string
 * @returns {string}
 */
export function resolvePostfix(format) {
  return format.endsWith('-runtime')
    ? `runtime.${format.replace(/-runtime$/, '')}`
    : format
}

/**
 * Resolve entry file based on format and package
 * @param {string} format - Build format
 * @param {boolean} isCompatPackage - Whether this is compat package
 * @returns {string}
 */
export function resolveEntryFile(format, isCompatPackage = false) {
  const isRuntime = /runtime$/.test(format)
  const isBrowserESMBuild = format.includes('esm-browser')
  const isBundlerESMBuild = format.includes('esm-bundler')

  if (isCompatPackage && (isBrowserESMBuild || isBundlerESMBuild)) {
    return isRuntime ? `src/esm-runtime.ts` : `src/esm-index.ts`
  }

  return isRuntime ? `src/runtime.ts` : `src/index.ts`
}
