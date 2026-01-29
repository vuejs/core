// @ts-check
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { replacePlugin } from 'rolldown/plugins'
import pico from 'picocolors'
import polyfillNode from '@rolldown/plugin-node-polyfills'
import { entries } from './aliases.js'
import { inlineEnums } from './inline-enums.js'
import { trimVaporExportsPlugin } from './trim-vapor-exports.js'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const masterVersion = require('../package.json').version
const consolidatePkg = require('@vue/consolidate/package.json')

const packagesDir = path.resolve(__dirname, '../packages')

/** @typedef {'cjs' | 'esm-bundler' | 'global' | 'global-runtime' | 'esm-browser' | 'esm-bundler-runtime' | 'esm-browser-runtime' | 'esm-browser-vapor'} PackageFormat */

/**
 * @param {{
 *   target: string
 *   commit: string
 *   formats?: PackageFormat[]
 *   devOnly?: boolean
 *   prodOnly?: boolean
 *   sourceMap?: boolean
 *   localDev?: boolean
 *   inlineDeps?: boolean
 * }} options
 */
export function createConfigsForPackage({
  target,
  commit,
  formats,
  devOnly = false,
  prodOnly = false,
  sourceMap = false,
  localDev = false,
  inlineDeps = false,
}) {
  const [enumPlugin, enumDefines] = localDev ? [] : inlineEnums()

  const packageDir = path.resolve(packagesDir, target)
  const resolve = (/** @type {string} */ p) => path.resolve(packageDir, p)
  const pkg = require(resolve(`package.json`))
  const packageOptions = pkg.buildOptions || {}
  const name = packageOptions.filename || path.basename(packageDir)

  const banner = `/**
  * ${pkg.name} v${masterVersion}
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/`

  /** @type {Record<PackageFormat, import('rolldown').OutputOptions>} */
  const outputConfigs = {
    'esm-bundler': {
      file: resolve(`dist/${name}.esm-bundler.js`),
      format: 'es',
    },
    'esm-browser': {
      file: resolve(`dist/${name}.esm-browser.js`),
      format: 'es',
    },
    cjs: {
      file: resolve(`dist/${name}.cjs.js`),
      format: 'cjs',
    },
    global: {
      file: resolve(`dist/${name}.global.js`),
      format: 'iife',
    },
    // runtime-only builds, for main "vue" package only
    'esm-bundler-runtime': {
      file: resolve(`dist/${name}.runtime.esm-bundler.js`),
      format: 'es',
    },
    'esm-browser-runtime': {
      file: resolve(`dist/${name}.runtime.esm-browser.js`),
      format: 'es',
    },
    'global-runtime': {
      file: resolve(`dist/${name}.runtime.global.js`),
      format: 'iife',
    },
    // The vapor format is a esm-browser + runtime only build that is meant for
    // the SFC playground only.
    'esm-browser-vapor': {
      file: resolve(`dist/${name}.runtime-with-vapor.esm-browser.js`),
      format: 'es',
    },
  }

  /** @type {PackageFormat[]} */
  const resolvedFormats = (
    formats ||
    packageOptions.formats || ['esm-bundler', 'cjs']
  ).filter((/** @type {PackageFormat} */ format) => outputConfigs[format])

  const packageConfigs = prodOnly
    ? []
    : resolvedFormats.map(format => createConfig(format, outputConfigs[format]))

  if (!devOnly) {
    resolvedFormats.forEach(format => {
      if (packageOptions.prod === false) {
        return
      }
      if (format === 'cjs') {
        packageConfigs.push(createProductionConfig(format))
      }
      if (
        format === 'esm-browser-vapor' ||
        /^(global|esm-browser)(-runtime)?/.test(format)
      ) {
        packageConfigs.push(createMinifiedConfig(format))
      }
    })
  }

  /**
   *
   * @param {PackageFormat} format
   * @param {import('rolldown').OutputOptions} output
   * @param {import('rolldown').Plugin[]} plugins
   * @returns {import('rolldown').RolldownOptions}
   */
  function createConfig(format, output, plugins = []) {
    if (!output) {
      console.error(pico.yellow(`invalid format: "${format}"`))
      process.exit(1)
    }

    const isProductionBuild = /\.prod\.js$/.test(String(output.file) || '')
    const isBundlerESMBuild = /esm-bundler/.test(format)
    const isBrowserESMBuild = /esm-browser/.test(format)
    const isServerRenderer = name === 'server-renderer'
    const isCJSBuild = format === 'cjs'
    const isGlobalBuild = /global/.test(format)
    const isCompatPackage =
      pkg.name === '@vue/compat' || pkg.name === '@vue/compat-canary'
    const isCompatBuild = !!packageOptions.compat
    const isBrowserBuild =
      (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
      !packageOptions.enableNonBrowserBranches

    output.postBanner = banner
    output.exports = isCompatPackage ? 'auto' : 'named'
    if (isCJSBuild) {
      output.esModule = true
    }
    output.sourcemap = sourceMap

    output.externalLiveBindings = false

    // TODO rolldown Not supported yet
    // output.reexportProtoFromExternal = false

    if (isGlobalBuild) {
      output.name = packageOptions.name
    }

    let entryFile = 'index.ts'
    if (pkg.name === 'vue') {
      if (format === 'esm-browser-vapor' || format === 'esm-bundler-runtime') {
        entryFile = 'runtime-with-vapor.ts'
      } else if (format === 'esm-bundler') {
        entryFile = 'index-with-vapor.ts'
      } else if (format.includes('runtime')) {
        entryFile = 'runtime.ts'
      }
    }

    // the compat build needs both default AND named exports.
    // we use separate entries for esm vs. non-esm builds.
    if (isCompatPackage && (isBrowserESMBuild || isBundlerESMBuild)) {
      entryFile = `esm-${entryFile}`
    }
    entryFile = 'src/' + entryFile

    function resolveDefine() {
      /** @type {Record<string, string>} */
      const defines = {
        __COMMIT__: `"${commit}"`,
        __VERSION__: `"${masterVersion}"`,
        // this is only used during Vue's internal tests
        __TEST__: `false`,
        // If the build is expected to run directly in the browser (global / esm builds)
        __BROWSER__: String(isBrowserBuild),
        __GLOBAL__: String(isGlobalBuild),
        __ESM_BUNDLER__: String(isBundlerESMBuild),
        __ESM_BROWSER__: String(isBrowserESMBuild),
        // is targeting Node (SSR)?
        __CJS__: String(isCJSBuild),
        // need SSR-specific branches?
        __SSR__: String(isCJSBuild || isBundlerESMBuild || isServerRenderer),

        // 2.x compat build
        __COMPAT__: String(isCompatBuild),

        // feature flags
        __FEATURE_SUSPENSE__: `true`,
        __FEATURE_OPTIONS_API__: isBundlerESMBuild
          ? `__VUE_OPTIONS_API__`
          : `true`,
        __FEATURE_PROD_DEVTOOLS__: isBundlerESMBuild
          ? `__VUE_PROD_DEVTOOLS__`
          : `false`,
        __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: isBundlerESMBuild
          ? `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`
          : `false`,
      }

      if (!isBundlerESMBuild) {
        // hard coded dev/prod builds
        defines.__DEV__ = String(!isProductionBuild)
      }

      // allow inline overrides like
      //__RUNTIME_COMPILE__=true pnpm build runtime-core
      Object.keys(defines).forEach(key => {
        if (key in process.env) {
          const value = process.env[key]
          assert(typeof value === 'string')
          defines[key] = value
        }
      })

      return defines
    }

    // define is a bit strict and only allows literal json or identifiers
    // so we still need replace plugin in some cases
    function resolveReplace() {
      /** @type {Record<string, string>} */
      const replacements = { ...enumDefines }

      if (isBundlerESMBuild) {
        Object.assign(replacements, {
          // preserve to be handled by bundlers
          __DEV__: `!!(process.env.NODE_ENV !== 'production')`,
        })
      }

      // for compiler-sfc browser build inlined deps
      if (isBrowserESMBuild && name === 'compiler-sfc') {
        Object.assign(replacements, {
          'process.env': '({})',
          'process.platform': '""',
          'process.stdout': 'null',
        })
      }

      if (Object.keys(replacements).length) {
        return [
          replacePlugin(replacements, {
            preventAssignment: true,
          }),
        ]
      } else {
        return []
      }
    }

    function resolveExternal() {
      const treeShakenDeps = [
        'source-map-js',
        '@babel/parser',
        'estree-walker',
        'entities/lib/decode.js',
      ]

      // we are bundling forked consolidate.js in compiler-sfc which dynamically
      // requires a ton of template engines which should be ignored.
      /** @type {string[]} */
      let cjsIgnores = []
      if (
        pkg.name === '@vue/compiler-sfc' ||
        pkg.name === '@vue/compiler-sfc-canary'
      ) {
        cjsIgnores = [
          ...Object.keys(consolidatePkg.devDependencies),
          'vm',
          'crypto',
          'react-dom/server',
          'teacup/lib/express',
          'arc-templates/dist/es5',
          'then-pug',
          'then-jade',
        ]
      }

      if (isGlobalBuild || isBrowserESMBuild || isCompatPackage || inlineDeps) {
        if (!packageOptions.enableNonBrowserBranches) {
          // normal browser builds - non-browser only imports are tree-shaken,
          // they are only listed here to suppress warnings.
          return treeShakenDeps
        } else {
          return cjsIgnores
        }
      } else {
        // Node / esm-bundler builds.
        // externalize all direct deps unless it's the compat build.
        return [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.peerDependencies || {}),
          // for @vue/compiler-sfc / server-renderer
          ...['path', 'url', 'stream'],
          // somehow these throw warnings for runtime-* package builds
          ...treeShakenDeps,
          ...cjsIgnores,
        ]
      }
    }

    function resolveNodePlugins() {
      const nodePlugins =
        (format === 'cjs' && Object.keys(pkg.devDependencies || {}).length) ||
        packageOptions.enableNonBrowserBranches
          ? [...(format === 'cjs' ? [] : [polyfillNode()])]
          : []
      return nodePlugins
    }

    return {
      input: resolve(entryFile),
      // Global and Browser ESM builds inlines everything so that they can be
      // used alone.
      external: resolveExternal(),
      transform: {
        define: resolveDefine(),
        target: isServerRenderer || isCJSBuild ? 'es2019' : 'es2016',
      },
      // IMPORTANT: the root tsconfig maps `vue` -> `runtime-with-vapor.ts` for TS usage.
      // For bundling we want `vue` to resolve to the normal entry to avoid pulling
      // runtime-vapor into non-vapor build graphs (e.g. server-renderer esm-browser).
      // this avoid MISSING_EXPORT errors for vapor-only exports.
      tsconfig: path.resolve(__dirname, '../tsconfig.rolldown.json'),
      platform:
        format === 'cjs' ? 'node' : isBundlerESMBuild ? 'neutral' : 'browser',
      resolve: {
        alias: entries,
      },
      plugins: [
        ...trimVaporExportsPlugin(format, pkg.name),
        ...(localDev ? [] : [enumPlugin]),
        ...resolveReplace(),
        ...resolveNodePlugins(),
        ...plugins,
      ],
      output,
      onwarn: (msg, warn) => {
        if (msg.code !== 'CIRCULAR_DEPENDENCY') {
          warn(msg)
        }
      },
      treeshake: {
        moduleSideEffects: false,
      },
      experimental: {
        nativeMagicString: true,
      },
    }
  }

  function createProductionConfig(/** @type {PackageFormat} */ format) {
    return createConfig(format, {
      file: resolve(`dist/${name}.${format}.prod.js`),
      format: outputConfigs[format].format,
    })
  }

  function createMinifiedConfig(/** @type {PackageFormat} */ format) {
    return createConfig(format, {
      file: String(outputConfigs[format].file).replace(/\.js$/, '.prod.js'),
      format: outputConfigs[format].format,
      minify: true,
    })
  }

  return packageConfigs
}
