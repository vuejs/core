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

import fs from 'node:fs'
import { parseArgs } from 'node:util'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import pico from 'picocolors'
import { cpus } from 'node:os'
import { targets as allTargets, exec, fuzzyMatchTarget } from './utils'
import { scanEnums } from './inline-enums'
import prettyBytes from 'pretty-bytes'
import { spawnSync } from 'node:child_process'

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
  formats,
  all: buildAllMatching,
  devOnly,
  prodOnly,
  withTypes: buildTypes,
  sourceMap,
  release: isRelease,
  size: writeSize,
} = values

const sizeDir = path.resolve('temp/size')

run()

async function run(): Promise<void> {
  if (writeSize) fs.mkdirSync(sizeDir, { recursive: true })
  const removeCache = scanEnums()
  try {
    const resolvedTargets = targets.length
      ? fuzzyMatchTarget(targets, buildAllMatching)
      : allTargets
    await buildAll(resolvedTargets)
    await checkAllSizes(resolvedTargets)
    if (buildTypes) {
      await exec('pnpm', [
        'run',
        'build-dts',
        ...(targets.length
          ? ['--environment', `TARGETS:${resolvedTargets.join(',')}`]
          : []),
      ])
    }
  } finally {
    removeCache()
  }
}

async function buildAll(targets: Array<string>): Promise<void> {
  await runParallel(cpus().length, targets, build)
}

async function runParallel<T>(
  maxConcurrency: number,
  source: Array<T>,
  iteratorFn: (item: T) => Promise<void>,
): Promise<void[]> {
  const ret: Promise<void>[] = []
  const executing: Promise<void>[] = []
  for (const item of source) {
    const p = Promise.resolve().then(() => iteratorFn(item))
    ret.push(p)

    if (maxConcurrency <= source.length) {
      const e = p.then(() => {
        executing.splice(executing.indexOf(e), 1)
      })
      executing.push(e)
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing)
      }
    }
  }
  return Promise.all(ret)
}

const privatePackages = fs.readdirSync('packages-private')

async function build(target: string): Promise<void> {
  const pkgBase = privatePackages.includes(target)
    ? `packages-private`
    : `packages`
  const pkgDir = path.resolve(`${pkgBase}/${target}`)
  const pkg = JSON.parse(fs.readFileSync(`${pkgDir}/package.json`, 'utf-8'))

  // if this is a full build (no specific targets), ignore private packages
  if ((isRelease || !targets.length) && pkg.private) {
    return
  }

  // if building a specific format, do not remove dist.
  if (!formats && fs.existsSync(`${pkgDir}/dist`)) {
    fs.rmSync(`${pkgDir}/dist`, { recursive: true })
  }

  const env =
    (pkg.buildOptions && pkg.buildOptions.env) ||
    (devOnly ? 'development' : 'production')

  await exec('rollup', [
    '-c',
    '--environment',
    [
      `COMMIT:${commit}`,
      `NODE_ENV:${env}`,
      `TARGET:${target}`,
      formats ? `FORMATS:${formats}` : ``,
      prodOnly ? `PROD_ONLY:true` : ``,
      sourceMap ? `SOURCE_MAP:true` : ``,
    ]
      .filter(Boolean)
      .join(','),
  ])
}

/**
 * Checks the sizes of all targets.
 */
async function checkAllSizes(targets: string[]): Promise<void> {
  if (devOnly || (formats && !formats.includes('global'))) {
    return
  }
  console.log()
  for (const target of targets) {
    await checkSize(target)
  }
  console.log()
}

async function checkSize(target: string): Promise<void> {
  const pkgDir = path.resolve(`packages/${target}`)
  await checkFileSize(`${pkgDir}/dist/${target}.global.prod.js`)
  if (!formats || formats.includes('global-runtime')) {
    await checkFileSize(`${pkgDir}/dist/${target}.runtime.global.prod.js`)
  }
}

async function checkFileSize(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
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

  if (writeSize)
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
