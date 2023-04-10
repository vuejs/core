// @ts-check
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import replace from '@rollup/plugin-replace'
import json from '@rollup/plugin-json'
import chalk from 'chalk'
import commonJS from '@rollup/plugin-commonjs'
import polyfillNode from 'rollup-plugin-polyfill-node'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import esbuild from 'rollup-plugin-esbuild'
import alias from '@rollup/plugin-alias'
import { entries } from './scripts/aliases.js'
import { constEnum } from './scripts/const-enum.js'

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

const [enumPlugin, enumDefines] = constEnum()

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
  const isCompatPackage =
    pkg.name === '@vue/compat' || pkg.name === '@vue/compat-canary'
  const isCompatBuild = !!packageOptions.compat
  const isBrowserBuild =
    (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
    !packageOptions.enableNonBrowserBranches

  output.exports = isCompatPackage ? 'auto' : 'named'
  if (isNodeBuild) {
    output.esModule = true
  }
  output.sourcemap = !!process.env.SOURCE_MAP
  output.externalLiveBindings = false

  if (isGlobalBuild) {
    output.name = packageOptions.name
  }

  let entryFile = /runtime$/.test(format) ? `src/runtime.ts` : `src/index.ts`

  // the compat build needs both default AND named exports. This will cause
  // Rollup to complain for non-ESM targets, so we use separate entries for
  // esm vs. non-esm builds.
  if (isCompatPackage && (isBrowserESMBuild || isBundlerESMBuild)) {
    entryFile = /runtime$/.test(format)
      ? `src/esm-runtime.ts`
      : `src/esm-index.ts`
  }

  function resolveDefine() {
    const replacements = {
      __COMMIT__: `"${process.env.COMMIT}"`,
      __VERSION__: `"${masterVersion}"`,
      // this is only used during Vue's internal tests
      __TEST__: `false`,
      // If the build is expected to run directly in the browser (global / esm builds)
      __BROWSER__: String(isBrowserBuild),
      __GLOBAL__: String(isGlobalBuild),
      __ESM_BUNDLER__: String(isBundlerESMBuild),
      __ESM_BROWSER__: String(isBrowserESMBuild),
      // is targeting Node (SSR)?
      __NODE_JS__: String(isNodeBuild),
      // need SSR-specific branches?
      __SSR__: String(isNodeBuild || isBundlerESMBuild || isServerRenderer),

      // 2.x compat build
      __COMPAT__: String(isCompatBuild),

      // feature flags
      __FEATURE_SUSPENSE__: `true`,
      __FEATURE_OPTIONS_API__: isBundlerESMBuild
        ? `__VUE_OPTIONS_API__`
        : `true`,
      __FEATURE_PROD_DEVTOOLS__: isBundlerESMBuild
        ? `__VUE_PROD_DEVTOOLS__`
        : `false`
    }

    if (!isBundlerESMBuild) {
      // hard coded dev/prod builds
      // @ts-ignore
      replacements.__DEV__ = String(!isProductionBuild)
    }

    // allow inline overrides like
    //__RUNTIME_COMPILE__=true pnpm build runtime-core
    Object.keys(replacements).forEach(key => {
      if (key in process.env) {
        replacements[key] = process.env[key]
      }
    })
    return replacements
  }

  // esbuild define is a bit strict and only allows literal json or identifiers
  // so we still need replace plugin in some cases
  function resolveReplace() {
    const replacements = { ...enumDefines }

    if (isProductionBuild && isBrowserBuild) {
      Object.assign(replacements, {
        'context.onError(': `/*#__PURE__*/ context.onError(`,
        'emitError(': `/*#__PURE__*/ emitError(`,
        'createCompilerError(': `/*#__PURE__*/ createCompilerError(`,
        'createDOMCompilerError(': `/*#__PURE__*/ createDOMCompilerError(`
      })
    }

    if (isBundlerESMBuild) {
      Object.assign(replacements, {
        // preserve to be handled by bundlers
        __DEV__: `process.env.NODE_ENV !== 'production'`
      })
    }

    // for compiler-sfc browser build inlined deps
    if (isBrowserESMBuild) {
      Object.assign(replacements, {
        'process.env': '({})',
        'process.platform': '""',
        'process.stdout': 'null'
      })
    }

    if (Object.keys(replacements).length) {
      // @ts-ignore
      return [replace({ values: replacements, preventAssignment: true })]
    } else {
      return []
    }
  }

  function resolveExternal() {
    const treeShakenDeps = ['source-map-js', '@babel/parser', 'estree-walker']

    if (isGlobalBuild || isBrowserESMBuild || isCompatPackage) {
      if (!packageOptions.enableNonBrowserBranches) {
        // normal browser builds - non-browser only imports are tree-shaken,
        // they are only listed here to suppress warnings.
        return treeShakenDeps
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
        ...treeShakenDeps
      ]
    }
  }

  function resolveNodePlugins() {
    // we are bundling forked consolidate.js in compiler-sfc which dynamically
    // requires a ton of template engines which should be ignored.
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

    return nodePlugins
  }

  return {
    input: resolve(entryFile),
    // Global and Browser ESM builds inlines everything so that they can be
    // used alone.
    external: resolveExternal(),
    plugins: [
      json({
        namedExports: false
      }),
      alias({
        entries
      }),
      enumPlugin,
      ...resolveReplace(),
      esbuild({
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
        sourceMap: output.sourcemap,
        minify: false,
        target: isServerRenderer || isNodeBuild ? 'es2019' : 'es2015',
        define: resolveDefine()
      }),
      ...resolveNodePlugins(),
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
