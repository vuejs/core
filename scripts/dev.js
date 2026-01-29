// @ts-check

import fs from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { watch } from 'rolldown'
import polyfillNode from '@rolldown/plugin-node-polyfills'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const fsShimPath = resolve(__dirname, 'shim-fs.js')

const {
  values: { format: rawFormat, prod, inline: inlineDeps },
  positionals,
} = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'global',
    },
    prod: {
      type: 'boolean',
      short: 'p',
      default: false,
    },
    inline: {
      type: 'boolean',
      short: 'i',
      default: false,
    },
  },
})

const format = rawFormat || 'global'
const targets = positionals.length ? positionals : ['vue']

const outputFormat = format.startsWith('global')
  ? 'iife'
  : format === 'cjs'
    ? 'cjs'
    : 'es'

const postfix = format.endsWith('-runtime')
  ? `runtime.${format.replace(/-runtime$/, '')}`
  : format

const privatePackages = fs.readdirSync('packages-private')

for (const target of targets) {
  const pkgBase = privatePackages.includes(target)
    ? `packages-private`
    : `packages`
  const pkgBasePath = `../${pkgBase}/${target}`
  const pkg = require(`${pkgBasePath}/package.json`)
  const outfile = resolve(
    __dirname,
    `${pkgBasePath}/dist/${
      target === 'vue-compat' ? `vue` : target
    }.${postfix}.${prod ? `prod.` : ``}js`,
  )
  const relativeOutfile = relative(process.cwd(), outfile)

  /** @type {string[]} */
  let external = []
  if (!inlineDeps) {
    if (format === 'cjs' || format.includes('esm-bundler')) {
      external = [
        ...external,
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
        'path',
        'url',
        'stream',
      ]
    }

    if (target === 'compiler-sfc') {
      const consolidatePkgPath = require.resolve(
        '@vue/consolidate/package.json',
        {
          paths: [resolve(__dirname, `../packages/${target}/`)],
        },
      )
      const consolidateDeps = Object.keys(
        require(consolidatePkgPath).devDependencies,
      )
      external = [
        ...external,
        ...consolidateDeps,
        'react-dom/server',
        'teacup/lib/express',
        'arc-templates/dist/es5',
        'then-pug',
        'then-jade',
      ]
      if (format === 'cjs' || format.includes('esm-bundler')) {
        external.push('fs', 'vm', 'crypto')
      }
    }
  }

  /** @type {import('rolldown').Plugin[]} */
  const plugins = []
  if (format !== 'cjs' && pkg.buildOptions?.enableNonBrowserBranches) {
    plugins.push(polyfillNode())
  }

  const platform = format === 'cjs' ? 'node' : 'browser'
  const resolveOptions =
    format === 'cjs'
      ? undefined
      : {
          alias: {
            // Alias built-in fs to a shim for browser builds.
            fs: fsShimPath,
          },
        }
  /** @type {import('rolldown').WatchOptions} */
  const config = {
    input: resolve(__dirname, `${pkgBasePath}/src/index.ts`),
    output: {
      file: outfile,
      format: outputFormat,
      sourcemap: true,
      name: format.startsWith('global') ? pkg.buildOptions?.name : undefined,
    },
    external,
    platform,
    resolve: resolveOptions,
    treeshake: {
      moduleSideEffects: false,
    },
    plugins,
    transform: {
      define: {
        __COMMIT__: `"dev"`,
        __VERSION__: `"${pkg.version}"`,
        __DEV__: prod ? `false` : `true`,
        __TEST__: `false`,
        __BROWSER__: String(
          format !== 'cjs' && !pkg.buildOptions?.enableNonBrowserBranches,
        ),
        __GLOBAL__: String(format === 'global'),
        __ESM_BUNDLER__: String(format.includes('esm-bundler')),
        __ESM_BROWSER__: String(format.includes('esm-browser')),
        __CJS__: String(format === 'cjs'),
        __SSR__: String(format !== 'global'),
        __COMPAT__: String(target === 'vue-compat'),
        __FEATURE_SUSPENSE__: `true`,
        __FEATURE_OPTIONS_API__: `true`,
        __FEATURE_PROD_DEVTOOLS__: `false`,
        __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: `true`,
      },
    },
  }

  console.log(`watching: ${relativeOutfile}`)
  watch(config).on('event', event => {
    if (event.code === 'BUNDLE_END') {
      // @ts-expect-error
      console.log(`built ${config.output.file} in ${event.duration}ms`)
    }
  })
}
