const fs = require('fs')
const path = require('path')
const ts = require('rollup-plugin-typescript2')
const replace = require('rollup-plugin-replace')
const alias = require('rollup-plugin-alias')

if (!process.env.TARGET) {
  throw new Error('TARGET package must be specified via --environment flag.')
}

const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.TARGET)
const name = path.basename(packageDir)
const resolve = p => path.resolve(packageDir, p)
const pkg = require(resolve(`package.json`))
const packageOptions = pkg.buildOptions || {}

// build aliases dynamically
const aliasOptions = { resolve: ['.ts'] }
fs.readdirSync(packagesDir).forEach(dir => {
  if (fs.statSync(path.resolve(packagesDir, dir)).isDirectory()) {
    aliasOptions[`@vue/${dir}`] = path.resolve(packagesDir, `${dir}/src/index`)
  }
})
const aliasPlugin = alias(aliasOptions)

// ensure TS checks only once for each build
let hasTSChecked = false

const configs = {
  esm: {
    file: resolve(`dist/${name}.esm-bundler.js`),
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
  'esm-browser': {
    file: resolve(`dist/${name}.esm-browser.js`),
    format: `es`
  }
}

const defaultFormats = ['esm', 'cjs']
const inlineFromats = process.env.FORMATS && process.env.FORMATS.split(',')
const packageFormats = inlineFromats || packageOptions.formats || defaultFormats
const packageConfigs = packageFormats.map(format =>
  createConfig(configs[format])
)

if (process.env.NODE_ENV === 'production') {
  packageFormats.forEach(format => {
    if (format === 'cjs') {
      packageConfigs.push(createProductionConfig(format))
    }
    if (format === 'global' || format === 'esm-browser') {
      packageConfigs.push(createMinifiedConfig(format))
    }
  })
}

module.exports = packageConfigs

function createConfig(output, plugins = []) {
  const isProductionBuild = /\.prod\.js$/.test(output.file)
  const isGlobalBuild = /\.global(\.prod)?\.js$/.test(output.file)
  const isBunlderESMBuild = /\.esm\.js$/.test(output.file)
  const isBrowserESMBuild = /esm-browser(\.prod)?\.js$/.test(output.file)

  if (isGlobalBuild) {
    output.name = packageOptions.name
  }

  const tsPlugin = ts({
    check: process.env.NODE_ENV === 'production' && !hasTSChecked,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'),
    tsconfigOverride: {
      compilerOptions: {
        declaration: process.env.NODE_ENV === 'production' && !hasTSChecked
      }
    }
  })
  // we only need to check TS and generate declarations once for each build.
  // it also seems to run into weird issues when checking multiple times
  // during a single build.
  hasTSChecked = true

  return {
    input: resolve(`src/index.ts`),
    // Global and Browser ESM builds inlines everything so that they can be
    // used alone.
    external:
      isGlobalBuild || isBrowserESMBuild ? [] : Object.keys(aliasOptions),
    plugins: [
      tsPlugin,
      aliasPlugin,
      createReplacePlugin(isProductionBuild, isBunlderESMBuild),
      ...plugins
    ],
    output,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    }
  }
}

function createReplacePlugin(isProduction, isBunlderESMBuild) {
  return replace({
    __DEV__: isBunlderESMBuild
      ? // preserve to be handled by bundlers
        `process.env.NODE_ENV !== 'production'`
      : // hard coded dev/prod builds
        !isProduction,
    // compatibility builds
    __COMPAT__: !!process.env.COMPAT
  })
}

function createProductionConfig(format) {
  return createConfig({
    file: resolve(`dist/${name}.${format}.prod.js`),
    format: configs[format].format
  })
}

function createMinifiedConfig(format) {
  const { terser } = require('rollup-plugin-terser')
  return createConfig(
    {
      file: resolve(`dist/${name}.${format}.prod.js`),
      format: configs[format].format
    },
    [
      terser({
        module: /^esm/.test(format)
      })
    ]
  )
}
