/*
Produce prodcution builds and stitch toegether d.ts files.

To specific the package to build, simply pass its name and the desired build
formats to output (defaults to `buildOptions.formats` specified in that package,
or "esm,cjs"):

```
# name supports fuzzy match. will build all packages with name containing "dom":
yarn build dom

# specify the format to output
yarn build core --formats cjs
```
*/

const fs = require('fs-extra')
const path = require('path')
const zlib = require('zlib')
const chalk = require('chalk')
const execa = require('execa')
const { compress } = require('brotli')
const { targets, fuzzyMatchTarget } = require('./utils')

const args = require('minimist')(process.argv.slice(2))
const target = args._[0]
const formats = args.formats || args.f
const buildAllMatching = args.all || args.a
;(async () => {
  if (!target) {
    await buildAll(targets)
    checkAllSizes(targets)
  } else {
    await buildAll(fuzzyMatchTarget(target, buildAllMatching))
    checkAllSizes(fuzzyMatchTarget(target, buildAllMatching))
  }
})()

async function buildAll(targets) {
  for (const target of targets) {
    await build(target)
  }
}

async function build(target) {
  const pkgDir = path.resolve(`packages/${target}`)
  const pkg = require(`${pkgDir}/package.json`)

  await fs.remove(`${pkgDir}/dist`)

  await execa(
    'rollup',
    [
      '-c',
      '--environment',
      `NODE_ENV:production,` +
        `TARGET:${target}` +
        (formats ? `,FORMATS:${formats}` : ``) +
        (args.types ? `,TYPES:true` : ``) +
        (args.p ? `,PROD_ONLY:true` : ``)
    ],
    { stdio: 'inherit' }
  )

  if (args.types && pkg.types) {
    console.log()
    console.log(
      chalk.bold(chalk.yellow(`Rolling up type definitions for ${target}...`))
    )

    // build types
    const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor')

    const extractorConfigPath = path.resolve(pkgDir, `api-extractor.json`)
    const extractorConfig = ExtractorConfig.loadFileAndPrepare(
      extractorConfigPath
    )
    const result = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: true
    })

    if (result.succeeded) {
      console.log(
        chalk.bold(chalk.green(`API Extractor completed successfully.`))
      )
    } else {
      console.error(
        `API Extractor completed with ${extractorResult.errorCount} errors` +
          ` and ${extractorResult.warningCount} warnings`
      )
      process.exitCode = 1
    }

    await fs.remove(`${pkgDir}/dist/packages`)
  }
}

function checkAllSizes(targets) {
  console.log()
  for (const target of targets) {
    checkSize(target)
  }
  console.log()
}

function checkSize(target) {
  const pkgDir = path.resolve(`packages/${target}`)
  const esmProdBuild = `${pkgDir}/dist/${target}.esm-browser.prod.js`
  if (fs.existsSync(esmProdBuild)) {
    const file = fs.readFileSync(esmProdBuild)
    const minSize = (file.length / 1024).toFixed(2) + 'kb'
    const compressed = compress(file)
    const compressedSize = (compressed.length / 1024).toFixed(2) + 'kb'
    console.log(
      `${chalk.gray(
        chalk.bold(target)
      )} min:${minSize} / brotli:${compressedSize}`
    )
  }
}
