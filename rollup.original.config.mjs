// @ts-check
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import ts from 'rollup-plugin-typescript2'
import replace from '@rollup/plugin-replace'
import json from '@rollup/plugin-json'
import chalk from 'chalk'
import commonJS from '@rollup/plugin-commonjs'
import polyfillNode from 'rollup-plugin-polyfill-node'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

if (!process.env.TARGET) {
  throw new Error('TARGET package must be specified via --environment flag.')
}

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const masterVersion = require('./package.json').version
const consolidatePkg = require('@vue/consolidate/package.json')

const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.TARGET)

const resolve = p => path.resolve(packageDir, p)
const pkg = require(resolve(`package.json`))
const packageOptions = pkg.buildOptions || {}
const name = packageOptions.filename || path.basename(packageDir)

// ensure TS checks only once for each build
let hasTSChecked = false

const outputConfigs = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: `es`
  },
  'esm-browser': {
    file: resolve(`dist/${name}.esm-browser.js`),
    format: `es`
  },
  cjs: {
    file: resolve(`dist/${name}.cjs.js`),
    format: `cjs`
  },
  global: {
    file: resolve(`dist/${name}.global.js`),
    format: `iife`
  },
  // runtime-only builds, for main "vue" package only
  'esm-bundler-runtime': {
    file: resolve(`dist/${name}.runtime.esm-bundler.js`),
    format: `es`
  },
  'esm-browser-runtime': {
    file: resolve(`dist/${name}.runtime.esm-browser.js`),
    format: 'es'
  },
  'global-runtime': {
    file: resolve(`dist/${name}.runtime.global.js`),
    format: 'iife'
  }
}

const defaultFormats = ['esm-bundler', 'cjs']
const inlineFormats = process.env.FORMATS && process.env.FORMATS.split(',')
const packageFormats = inlineFormats || packageOptions.formats || defaultFormats
const packageConfigs = process.env.PROD_ONLY
  ? []
  : packageFormats.map(format => createConfig(format, outputConfigs[format]))

if (process.env.NODE_ENV === 'production') {
  packageFormats.forEach(format => {
    if (packageOptions.prod === false) {
      return
    }
    if (format === 'cjs') {
      packageConfigs.push(createProductionConfig(format))
    }
    if (/^(global|esm-browser)(-runtime)?/.test(format)) {
      packageConfigs.push(createMinifiedConfig(format))
    }
  })
}

export default packageConfigs

function createConfig(format, output, plugins = []) {
  if (!output) {
    console.log(chalk.yellow(`invalid format: "${format}"`))
    process.exit(1)
  }

  const isProductionBuild =
    process.env.__DEV__ === 'false' || /\.prod\.js$/.test(output.file)
  const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)
  const isServerRenderer = name === 'server-renderer'
  const isNodeBuild = format === 'cjs'
  const isGlobalBuild = /global/.test(format)
  const isCompatPackage = pkg.name === '@vue/compat'
  const isCompatBuild = !!packageOptions.compat

  output.exports = isCompatPackage ? 'auto' : 'named'
  output.esModule = true
  output.sourcemap = !!process.env.SOURCE_MAP
  output.externalLiveBindings = false

  if (isGlobalBuild) {
    output.name = packageOptions.name
  }

  const shouldEmitDeclarations =
    pkg.types && process.env.TYPES != null && !hasTSChecked

  const tsPlugin = ts({
    check: process.env.NODE_ENV === 'production' && !hasTSChecked,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'),
    tsconfigOverride: {
      compilerOptions: {
        target: isServerRenderer || isNodeBuild ? 'es2019' : 'es2015',
        sourceMap: output.sourcemap,
        declaration: shouldEmitDeclarations,
        declarationMap: shouldEmitDeclarations
      },
      exclude: ['**/__tests__', 'test-dts']
    }
  })
  // we only need to check TS and generate declarations once for each build.
  // it also seems to run into weird issues when checking multiple times
  // during a single build.
  hasTSChecked = true

  let entryFile = /runtime$/.test(format) ? `src/runtime.ts` : `src/index.ts`

  // the compat build needs both default AND named exports. This will cause
  // Rollup to complain for non-ESM targets, so we use separate entries for
  // esm vs. non-esm builds.
  if (isCompatPackage && (isBrowserESMBuild || isBundlerESMBuild)) {
    entryFile = /runtime$/.test(format)
      ? `src/esm-runtime.ts`
      : `src/esm-index.ts`
  }

  let external = []
  const treeShakenDeps = ['source-map', '@babel/parser', 'estree-walker']

  if (isGlobalBuild || isBrowserESMBuild || isCompatPackage) {
    if (!packageOptions.enableNonBrowserBranches) {
      // normal browser builds - non-browser only imports are tree-shaken,
      // they are only listed here to suppress warnings.
      external = treeShakenDeps
    }
  } else {
    // Node / esm-bundler builds.
    // externalize all direct deps unless it's the compat build.
    external = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      // for @vue/compiler-sfc / server-renderer
      ...['path', 'url', 'stream'],
      // somehow these throw warnings for runtime-* package builds
      ...treeShakenDeps
    ]
  }

  // we are bundling forked consolidate.js in compiler-sfc which dynamically
  // requires a ton of template engines which should be ignored.
  let cjsIgnores = []
  if (pkg.name === '@vue/compiler-sfc') {
    cjsIgnores = [
      ...Object.keys(consolidatePkg.devDependencies),
      'vm',
      'crypto',
      'react-dom/server',
      'teacup/lib/express',
      'arc-templates/dist/es5',
      'then-pug',
      'then-jade'
    ]
  }

  const nodePlugins =
    (format === 'cjs' && Object.keys(pkg.devDependencies || {}).length) ||
    packageOptions.enableNonBrowserBranches
      ? [
          commonJS({
            sourceMap: false,
            ignore: cjsIgnores
          }),
          ...(format === 'cjs' ? [] : [polyfillNode()]),
          nodeResolve()
        ]
      : []

  if (format === 'cjs') {
    nodePlugins.push(cjsReExportsPatchPlugin())
  }

  return {
    input: resolve(entryFile),
    // Global and Browser ESM builds inlines everything so that they can be
    // used alone.
    external,
    plugins: [
      json({
        namedExports: false
      }),
      tsPlugin,
      createReplacePlugin(
        isProductionBuild,
        isBundlerESMBuild,
        isBrowserESMBuild,
        // isBrowserBuild?
        (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
          !packageOptions.enableNonBrowserBranches,
        isGlobalBuild,
        isNodeBuild,
        isCompatBuild,
        isServerRenderer
      ),
      ...nodePlugins,
      ...plugins
    ],
    output,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    },
    treeshake: {
      moduleSideEffects: false
    }
  }
}

function createReplacePlugin(
  isProduction,
  isBundlerESMBuild,
  isBrowserESMBuild,
  isBrowserBuild,
  isGlobalBuild,
  isNodeBuild,
  isCompatBuild,
  isServerRenderer
) {
  const replacements = {
    __COMMIT__: `"${process.env.COMMIT}"`,
    __VERSION__: `"${masterVersion}"`,
    __DEV__: isBundlerESMBuild
      ? // preserve to be handled by bundlers
        `(process.env.NODE_ENV !== 'production')`
      : // hard coded dev/prod builds
        !isProduction,
    // this is only used during Vue's internal tests
    __TEST__: false,
    // If the build is expected to run directly in the browser (global / esm builds)
    __BROWSER__: isBrowserBuild,
    __GLOBAL__: isGlobalBuild,
    __ESM_BUNDLER__: isBundlerESMBuild,
    __ESM_BROWSER__: isBrowserESMBuild,
    // is targeting Node (SSR)?
    __NODE_JS__: isNodeBuild,
    // need SSR-specific branches?
    __SSR__: isNodeBuild || isBundlerESMBuild || isServerRenderer,

    // for compiler-sfc browser build inlined deps
    ...(isBrowserESMBuild
      ? {
          'process.env': '({})',
          'process.platform': '""',
          'process.stdout': 'null'
        }
      : {}),

    // 2.x compat build
    __COMPAT__: isCompatBuild,

    // feature flags
    __FEATURE_SUSPENSE__: true,
    __FEATURE_OPTIONS_API__: isBundlerESMBuild ? `__VUE_OPTIONS_API__` : true,
    __FEATURE_PROD_DEVTOOLS__: isBundlerESMBuild
      ? `__VUE_PROD_DEVTOOLS__`
      : false,
    ...(isProduction && isBrowserBuild
      ? {
          'context.onError(': `/*#__PURE__*/ context.onError(`,
          'emitError(': `/*#__PURE__*/ emitError(`,
          'createCompilerError(': `/*#__PURE__*/ createCompilerError(`,
          'createDOMCompilerError(': `/*#__PURE__*/ createDOMCompilerError(`
        }
      : {})
  }
  // allow inline overrides like
  //__RUNTIME_COMPILE__=true yarn build runtime-core
  Object.keys(replacements).forEach(key => {
    if (key in process.env) {
      replacements[key] = process.env[key]
    }
  })
  return replace({
    // @ts-ignore
    values: replacements,
    preventAssignment: true
  })
}

function createProductionConfig(format) {
  return createConfig(format, {
    file: resolve(`dist/${name}.${format}.prod.js`),
    format: outputConfigs[format].format
  })
}

function createMinifiedConfig(format) {
  return createConfig(
    format,
    {
      file: outputConfigs[format].file.replace(/\.js$/, '.prod.js'),
      format: outputConfigs[format].format
    },
    [
      terser({
        module: /^esm/.test(format),
        compress: {
          ecma: 2015,
          pure_getters: true
        },
        safari10: true
      })
    ]
  )
}

// temporary patch for https://github.com/nodejs/cjs-module-lexer/issues/79
//
// When importing a cjs module from esm, Node.js uses cjs-module-lexer to
// detect * re-exports from other packages. However, the detection logic is
// fragile and breaks when Rollup generates different code for the re-exports.
// We were locked on an old version of Rollup because of this.
//
// The latest versions of Node ships an updated version of cjs-module-lexer that
// has fixed https://github.com/nodejs/cjs-module-lexer/issues/38, however we
// still need to support older versions of Node that does not have the latest
// version of cjs-module-lexer (Node < 14.18)
//
// At the same time, we want to upgrade to Rollup 3 so we are not forever locked
// on an old version of Rollup.
//
// What this patch does:
// 1. Rewrite the for...in loop to Object.keys() so cjs-module-lexer can find it
//    The for...in loop is only used when output.externalLiveBindings is set to
//    false, and we do want to set it to false to avoid perf costs during SSR.
// 2. Also remove exports.hasOwnProperty check, which breaks the detection in
//    Node.js versions that
//
// TODO in the future, we should no longer rely on this if we inline all deps
// in the main `vue` package.
function cjsReExportsPatchPlugin() {
  const matcher =
    /for \(var k in (\w+)\) {(\s+if \(k !== 'default') && !exports.hasOwnProperty\(k\)(\) exports\[k\] = (?:\w+)\[k\];\s+)}/
  return {
    name: 'patch-cjs-re-exports',
    renderChunk(code, _, options) {
      if (matcher.test(code)) {
        return code.replace(matcher, (_, r1, r2, r3) => {
          return `Object.keys(${r1}).forEach(function(k) {${r2}${r3}});`
        })
      } else if (options.file.endsWith('packages/vue/dist/vue.cjs.js')) {
        // make sure we don't accidentally miss the rewrite in case Rollup
        // changes the output again.
        throw new Error('cjs build re-exports rewrite failed.')
      }
    }
  }
}
