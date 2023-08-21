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

import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import minimist from 'minimist'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import chalk from 'chalk'
import execa from 'execa'
import { cpus } from 'node:os'
import { createRequire } from 'node:module'
import { targets as allTargets, fuzzyMatchTarget } from './utils.js'
import { scanEnums } from './const-enum.js'
import prettyBytes from 'pretty-bytes'

const require = createRequire(import.meta.url)
const args = minimist(process.argv.slice(2))
const targets = args._
const formats = args.formats || args.f
const devOnly = args.devOnly || args.d
const prodOnly = !devOnly && (args.prodOnly || args.p)
const buildTypes = args.withTypes || args.t
const sourceMap = args.sourcemap || args.s
const isRelease = args.release
const buildAllMatching = args.all || args.a
const writeSize = args.size
const commit = execa.sync('git', ['rev-parse', 'HEAD']).stdout.slice(0, 7)

const sizeDir = path.resolve('temp/size')

run()

async function run() {
  if (writeSize) await fs.mkdir(sizeDir, { recursive: true })
  const removeCache = scanEnums()
  try {
    const resolvedTargets = targets.length
      ? fuzzyMatchTarget(targets, buildAllMatching)
      : allTargets
    await buildAll(resolvedTargets)
    await checkAllSizes(resolvedTargets)
    if (buildTypes) {
      await execa(
        'pnpm',
        [
          'run',
          'build-dts',
          ...(targets.length
            ? ['--environment', `TARGETS:${resolvedTargets.join(',')}`]
            : [])
        ],
        {
          stdio: 'inherit'
        }
      )
    }
  } finally {
    removeCache()
  }
}

async function buildAll(targets) {
  await runParallel(cpus().length, targets, build)
}

async function runParallel(maxConcurrency, source, iteratorFn) {
  const ret = []
  const executing = []
  for (const item of source) {
    const p = Promise.resolve().then(() => iteratorFn(item, source))
    ret.push(p)

    if (maxConcurrency <= source.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing)
      }
    }
  }
  return Promise.all(ret)
}

async function build(target) {
  const pkgDir = path.resolve(`packages/${target}`)
  const pkg = require(`${pkgDir}/package.json`)

  // if this is a full build (no specific targets), ignore private packages
  if ((isRelease || !targets.length) && pkg.private) {
    return
  }

  // if building a specific format, do not remove dist.
  if (!formats && existsSync(`${pkgDir}/dist`)) {
    await fs.rm(`${pkgDir}/dist`, { recursive: true })
  }

  const env =
    (pkg.buildOptions && pkg.buildOptions.env) ||
    (devOnly ? 'development' : 'production')
  await execa(
    'rollup',
    [
      '-c',
      '--environment',
      [
        `COMMIT:${commit}`,
        `NODE_ENV:${env}`,
        `TARGET:${target}`,
        formats ? `FORMATS:${formats}` : ``,
        prodOnly ? `PROD_ONLY:true` : ``,
        sourceMap ? `SOURCE_MAP:true` : ``
      ]
        .filter(Boolean)
        .join(',')
    ],
    { stdio: 'inherit' }
  )
}

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

async function checkSize(target) {
  const pkgDir = path.resolve(`packages/${target}`)
  await checkFileSize(`${pkgDir}/dist/${target}.global.prod.js`)
  if (!formats || formats.includes('global-runtime')) {
    await checkFileSize(`${pkgDir}/dist/${target}.runtime.global.prod.js`)
  }
}

async function checkFileSize(filePath) {
  if (!existsSync(filePath)) {
    return
  }
  const file = await fs.readFile(filePath)
  const fileName = path.basename(filePath)

  const gzipped = gzipSync(file)
  const brotli = brotliCompressSync(file)

  console.log(
    `${chalk.gray(chalk.bold(fileName))} min:${prettyBytes(
      file.length
    )} / gzip:${prettyBytes(gzipped.length)} / brotli:${prettyBytes(
      brotli.length
    )}`
  )

  if (writeSize)
    await fs.writeFile(
      path.resolve(sizeDir, `${fileName}.json`),
      JSON.stringify({
        file: fileName,
        size: file.length,
        gzip: gzipped.length,
        brotli: brotli.length
      }),
      'utf-8'
    )
}
