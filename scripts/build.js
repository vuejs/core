// @ts-check

/*
Produces production builds and stitches together d.ts files.

To specify the package to build, simply pass its name and the desired build
formats to output (defaults to `buildOptions.formats` specified in that package,
or "esm,cjs"):

```
# name supports fuzzy match. will build all packages with name containing "dom":
nr build dom

# specify the format to output
nr build core --formats cjs
```
*/

import { rolldown } from 'rolldown'
import fs from 'node:fs'
import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import pico from 'picocolors'
import { targets as allTargets, fuzzyMatchTarget } from './utils.js'
import prettyBytes from 'pretty-bytes'
import { spawnSync } from 'node:child_process'
import { createConfigsForPackage } from './create-rolldown-config.js'
import { scanEnums } from './inline-enums.js'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const privatePackages = fs.readdirSync('packages-private')
const commit = spawnSync('git', ['rev-parse', '--short=7', 'HEAD'])
  .stdout.toString()
  .trim()

const { values, positionals: targets } = parseArgs({
  allowPositionals: true,
  options: {
    formats: {
      type: 'string',
      short: 'f',
    },
    devOnly: {
      type: 'boolean',
      short: 'd',
    },
    prodOnly: {
      type: 'boolean',
      short: 'p',
    },
    withTypes: {
      type: 'boolean',
      short: 't',
    },
    sourceMap: {
      type: 'boolean',
      short: 's',
    },
    release: {
      type: 'boolean',
    },
    all: {
      type: 'boolean',
      short: 'a',
    },
    size: {
      type: 'boolean',
    },
  },
})

const {
  formats: rawFormats,
  all: buildAllMatching,
  devOnly,
  prodOnly,
  withTypes: buildTypes,
  sourceMap,
  release: isRelease,
  size,
} = values

const formats = rawFormats?.split(',')
const sizeDir = path.resolve('temp/size')

run()

async function run() {
  if (size) fs.mkdirSync(sizeDir, { recursive: true })
  const removeCache = scanEnums()
  try {
    const resolvedTargets = targets.length
      ? fuzzyMatchTarget(targets, buildAllMatching)
      : allTargets
    await buildAll(resolvedTargets)
    if (size) await checkAllSizes(resolvedTargets)
    if (buildTypes) {
      await import('./build-types.js')
    }
  } finally {
    removeCache()
  }
}

/**
 * Builds all the targets in parallel.
 * @param {Array<string>} targets - An array of targets to build.
 * @returns {Promise<void>} - A promise representing the build process.
 */
async function buildAll(targets) {
  const start = performance.now()
  const all = []
  let count = 0
  for (const t of targets) {
    const configs = createConfigsForTarget(t)
    if (configs) {
      all.push(
        Promise.all(
          configs.map(c =>
            rolldown(c).then(bundle => {
              return bundle.write(c.output).then(() => {
                // @ts-expect-error
                return path.join('packages', t, 'dist', c.output.entryFileNames)
              })
            }),
          ),
        ).then(files => {
          files.forEach(f => {
            count++
            console.log(pico.gray('built: ') + pico.green(f))
          })
        }),
      )
    }
  }
  await Promise.all(all)
  console.log(
    `\n${count} files built in ${(performance.now() - start).toFixed(2)}ms.`,
  )
}

/**
 * Builds the target.
 * @param {string} target - The target to build.
 * @returns {import('rolldown').RolldownOptions[] | void} - A promise representing the build process.
 */
function createConfigsForTarget(target) {
  const pkgBase = privatePackages.includes(target)
    ? `packages-private`
    : `packages`
  const pkgDir = path.resolve(__dirname, `../${pkgBase}/${target}`)
  const pkg = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf-8'))

  // if this is a full build (no specific targets), ignore private packages
  if ((isRelease || !targets.length) && pkg.private) {
    return
  }

  // if building a specific format, do not remove dist.
  if (!formats && existsSync(`${pkgDir}/dist`)) {
    fs.rmSync(`${pkgDir}/dist`, { recursive: true })
  }

  return createConfigsForPackage({
    target,
    commit,
    // @ts-expect-error
    formats,
    prodOnly,
    devOnly:
      (pkg.buildOptions && pkg.buildOptions.env === 'development') || devOnly,
    sourceMap,
  })
}

/**
 * Checks the sizes of all targets.
 * @param {string[]} targets - The targets to check sizes for.
 * @returns {Promise<void>}
 */
async function checkAllSizes(targets) {
  if (devOnly || (formats && !formats.includes('global'))) {
    return
  }
  console.log()
  for (const target of targets) {
    await checkSize(target)
  }
  console.log()
}

/**
 * Checks the size of a target.
 * @param {string} target - The target to check the size for.
 * @returns {Promise<void>}
 */
async function checkSize(target) {
  const pkgDir = path.resolve(__dirname, `../packages/${target}`)
  await checkFileSize(`${pkgDir}/dist/${target}.global.prod.js`)
  if (!formats || formats.includes('global-runtime')) {
    await checkFileSize(`${pkgDir}/dist/${target}.runtime.global.prod.js`)
  }
}

/**
 * Checks the file size.
 * @param {string} filePath - The path of the file to check the size for.
 * @returns {Promise<void>}
 */
async function checkFileSize(filePath) {
  if (!existsSync(filePath)) {
    return
  }
  const file = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)

  const gzipped = gzipSync(file)
  const brotli = brotliCompressSync(file)

  console.log(
    `${pico.gray(pico.bold(fileName))} min:${prettyBytes(
      file.length,
    )} / gzip:${prettyBytes(gzipped.length)} / brotli:${prettyBytes(
      brotli.length,
    )}`,
  )

  if (size)
    fs.writeFileSync(
      path.resolve(sizeDir, `${fileName}.json`),
      JSON.stringify({
        file: fileName,
        size: file.length,
        gzip: gzipped.length,
        brotli: brotli.length,
      }),
      'utf-8',
    )
}
