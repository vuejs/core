const fs = require('fs-extra')
const path = require('path')
const zlib = require('zlib')
const chalk = require('chalk')
const execa = require('execa')
const dts = require('dts-bundle')
const { targets, fuzzyMatchTarget } = require('./utils')

const target = process.argv[2]

;(async () => {
  if (!target) {
    await buildAll(targets)
    checkAllSizes(targets)
  } else {
    await buildAll(fuzzyMatchTarget(target))
    checkAllSizes(fuzzyMatchTarget(target))
  }
})()

async function buildAll (targets) {
  for (const target of targets) {
    await build(target)
  }
}

async function build (target) {
  const pkgDir = path.resolve(`packages/${target}`)

  await fs.remove(`${pkgDir}/dist`)

  await execa('rollup', [
    '-c',
    '--environment',
    `NODE_ENV:production,TARGET:${target}`
  ], { stdio: 'inherit' })

  const dtsOptions = {
    name: target === 'vue' ? target : `@vue/${target}`,
    main: `${pkgDir}/dist/packages/${target}/src/index.d.ts`,
    out: `${pkgDir}/dist/index.d.ts`
  }
  dts.bundle(dtsOptions)
  console.log()
  console.log(chalk.blue(chalk.bold(`generated typings at ${dtsOptions.out}`)))

  await fs.remove(`${pkgDir}/dist/packages`)
}

function checkAllSizes (targets) {
  console.log()
  for (const target of targets) {
    checkSize(target)
  }
  console.log()
}

function checkSize (target) {
  const pkgDir = path.resolve(`packages/${target}`)
  const esmProdBuild = `${pkgDir}/dist/${target}.esm-browser.prod.js`
  if (fs.existsSync(esmProdBuild)) {
    const file = fs.readFileSync(esmProdBuild)
    const minSize = (file.length / 1024).toFixed(2) + 'kb'
    const gzipped = zlib.gzipSync(file)
    const gzipSize = (gzipped.length / 1024).toFixed(2) + 'kb'
    console.log(`${
      chalk.gray(chalk.bold(target))
    } min:${minSize} / gzip:${gzipSize}`)
  }
}
