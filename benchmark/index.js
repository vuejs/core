// @ts-check
import path from 'node:path'
import { parseArgs } from 'node:util'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import Vue from '@vitejs/plugin-vue'
import { build } from 'vite'
import connect from 'connect'
import sirv from 'sirv'
import { launch } from 'puppeteer'
import colors from 'picocolors'
import { exec, getSha } from '../scripts/utils.js'
import process from 'node:process'
import readline from 'node:readline'

// Thanks to https://github.com/krausest/js-framework-benchmark (Apache-2.0 license)
const {
  values: {
    skipLib,
    skipApp,
    skipBench,
    vdom,
    noVapor,
    port: portStr,
    count: countStr,
    warmupCount: warmupCountStr,
    noHeadless,
    devBuild,
  },
} = parseArgs({
  allowNegative: true,
  allowPositionals: true,
  options: {
    skipLib: {
      type: 'boolean',
      short: 'l',
    },
    skipApp: {
      type: 'boolean',
      short: 'a',
    },
    skipBench: {
      type: 'boolean',
      short: 'b',
    },
    noVapor: {
      type: 'boolean',
    },
    vdom: {
      type: 'boolean',
      short: 'v',
    },
    port: {
      type: 'string',
      short: 'p',
      default: '8193',
    },
    count: {
      type: 'string',
      short: 'c',
      default: '30',
    },
    warmupCount: {
      type: 'string',
      short: 'w',
      default: '5',
    },
    noHeadless: {
      type: 'boolean',
    },
    devBuild: {
      type: 'boolean',
      short: 'd',
    },
  },
})

const port = +(/** @type {string}*/ (portStr))
const count = +(/** @type {string}*/ (countStr))
const warmupCount = +(/** @type {string}*/ (warmupCountStr))
const sha = await getSha(true)

if (!skipLib) {
  await buildLib()
}
if (!skipApp) {
  await rm('client/dist', { recursive: true }).catch(() => {})
  vdom && (await buildApp(false))
  !noVapor && (await buildApp(true))
}
const server = startServer()

if (!skipBench) {
  await benchmark()
  server.close()
}

async function buildLib() {
  console.info(colors.blue('Building lib...'))

  /** @type {import('node:child_process').SpawnOptions} */
  const options = {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, BENCHMARK: 'true' },
  }
  const buildOptions = devBuild ? '-df' : '-pf'
  const [{ ok }, { ok: ok2 }, { ok: ok3 }, { ok: ok4 }] = await Promise.all([
    exec(
      'pnpm',
      `run --silent build shared compiler-core compiler-dom compiler-vapor ${buildOptions} cjs`.split(
        ' ',
      ),
      options,
    ),
    exec(
      'pnpm',
      'run --silent build compiler-sfc compiler-ssr -f cjs'.split(' '),
      options,
    ),
    exec(
      'pnpm',
      `run --silent build vue-vapor ${buildOptions} esm-browser`.split(' '),
      options,
    ),
    exec(
      'pnpm',
      `run --silent build vue ${buildOptions} esm-browser-runtime`.split(' '),
      options,
    ),
  ])

  if (!ok || !ok2 || !ok3 || !ok4) {
    console.error('Failed to build')
    process.exit(1)
  }
}

/** @param {boolean} isVapor */
async function buildApp(isVapor) {
  console.info(
    colors.blue(`\nBuilding ${isVapor ? 'Vapor' : 'Virtual DOM'} app...\n`),
  )

  if (!devBuild) process.env.NODE_ENV = 'production'
  const CompilerSFC = await import(
    '../packages/compiler-sfc/dist/compiler-sfc.cjs.js'
  )
  const prodSuffix = devBuild ? '.js' : '.prod.js'

  /** @type {any} */
  const TemplateCompiler = await import(
    (isVapor
      ? '../packages/compiler-vapor/dist/compiler-vapor.cjs'
      : '../packages/compiler-dom/dist/compiler-dom.cjs') + prodSuffix
  )
  const runtimePath = path.resolve(
    import.meta.dirname,
    (isVapor
      ? '../packages/vue-vapor/dist/vue-vapor.esm-browser'
      : '../packages/vue/dist/vue.runtime.esm-browser') + prodSuffix,
  )

  const mode = isVapor ? 'vapor' : 'vdom'
  await build({
    root: './client',
    base: `/${mode}`,
    define: {
      'import.meta.env.IS_VAPOR': String(isVapor),
    },
    build: {
      minify: !devBuild && 'terser',
      outDir: path.resolve('./client/dist', mode),
      rollupOptions: {
        onwarn(log, handler) {
          if (log.code === 'INVALID_ANNOTATION') return
          handler(log)
        },
      },
    },
    resolve: {
      alias: {
        '@vue/vapor': runtimePath,
        'vue/vapor': runtimePath,
        vue: runtimePath,
      },
    },
    clearScreen: false,
    plugins: [
      Vue({
        compiler: CompilerSFC,
        template: { compiler: TemplateCompiler },
      }),
    ],
  })
}

function startServer() {
  const server = connect().use(sirv('./client/dist')).listen(port)
  printPort(port)
  process.on('SIGTERM', () => server.close())
  return server
}

async function benchmark() {
  console.info(colors.blue(`\nStarting benchmark...`))

  const browser = await initBrowser()

  await mkdir('results', { recursive: true }).catch(() => {})
  if (!noVapor) {
    await doBench(browser, true)
  }
  if (vdom) {
    await doBench(browser, false)
  }

  await browser.close()
}

/**
 *
 * @param {import('puppeteer').Browser} browser
 * @param {boolean} isVapor
 */
async function doBench(browser, isVapor) {
  const mode = isVapor ? 'vapor' : 'vdom'
  console.info('\n\nmode:', mode)

  const page = await browser.newPage()
  page.emulateCPUThrottling(4)
  await page.goto(`http://localhost:${port}/${mode}`, {
    waitUntil: 'networkidle0',
  })

  await forceGC()
  const t = performance.now()

  console.log('warmup run')
  await eachRun(() => withoutRecord(benchOnce), warmupCount)

  console.log('benchmark run')
  await eachRun(benchOnce, count)

  console.info(
    'Total time:',
    colors.cyan(((performance.now() - t) / 1000).toFixed(2)),
    's',
  )
  const times = await getTimes()
  const result =
    /** @type {Record<string, typeof compute>} */
    Object.fromEntries(Object.entries(times).map(([k, v]) => [k, compute(v)]))

  console.table(result)
  await writeFile(
    `results/benchmark-${sha}-${mode}.json`,
    JSON.stringify(result, undefined, 2),
  )
  await page.close()
  return result

  async function benchOnce() {
    await clickButton('run') // test: create rows
    await clickButton('update') // partial update
    await clickButton('swaprows') // swap rows
    await select() // test: select row, remove row
    await clickButton('clear') // clear rows

    await withoutRecord(() => clickButton('run'))
    await clickButton('add') // append rows to large table

    await withoutRecord(() => clickButton('clear'))
    await clickButton('runLots') // create many rows
    await withoutRecord(() => clickButton('clear'))

    // TODO replace all rows
  }

  function getTimes() {
    return page.evaluate(() => /** @type {any} */ (globalThis).times)
  }

  async function forceGC() {
    await page.evaluate(
      `window.gc({type:'major',execution:'sync',flavor:'last-resort'})`,
    )
  }

  /** @param {() => any} fn */
  async function withoutRecord(fn) {
    const currentRecordTime = await page.evaluate(() => globalThis.recordTime)
    await page.evaluate(() => (globalThis.recordTime = false))
    await fn()
    await page.evaluate(
      currentRecordTime => (globalThis.recordTime = currentRecordTime),
      currentRecordTime,
    )
  }

  /** @param {string} id */
  async function clickButton(id) {
    await page.click(`#${id}`)
    await wait()
  }

  async function select() {
    for (let i = 1; i <= 10; i++) {
      await page.click(`tbody > tr:nth-child(2) > td:nth-child(2) > a`)
      await page.waitForSelector(`tbody > tr:nth-child(2).danger`)
      await page.click(`tbody > tr:nth-child(2) > td:nth-child(3) > button`)
      await wait()
    }
  }

  async function wait() {
    await page.waitForSelector('.done')
  }
}

/**
 * @param {Function} bench
 * @param {number} count
 */
async function eachRun(bench, count) {
  for (let i = 0; i < count; i++) {
    readline.cursorTo(process.stdout, 0)
    readline.clearLine(process.stdout, 0)
    process.stdout.write(`${i + 1}/${count}`)
    await bench()
  }
  if (count === 0) {
    process.stdout.write('0/0 (skip)')
  }
  process.stdout.write('\n')
}

async function initBrowser() {
  const disableFeatures = [
    'Translate', // avoid translation popups
    'PrivacySandboxSettings4', // avoid privacy popup
    'IPH_SidePanelGenericMenuFeature', // bookmark popup see https://github.com/krausest/js-framework-benchmark/issues/1688
  ]

  const args = [
    '--js-flags=--expose-gc', // needed for gc() function
    '--no-default-browser-check',
    '--disable-sync',
    '--no-first-run',
    '--ash-no-nudges',
    '--disable-extensions',
    `--disable-features=${disableFeatures.join(',')}`,
  ]

  const headless = !noHeadless
  console.info('headless:', headless)
  const browser = await launch({
    headless: headless,
    args,
  })
  console.log('browser version:', colors.blue(await browser.version()))

  return browser
}

/** @param {number[]} array */
function compute(array) {
  const n = array.length
  const max = Math.max(...array)
  const min = Math.min(...array)
  const mean = array.reduce((a, b) => a + b) / n
  const std = Math.sqrt(
    array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
  )
  const median = array.slice().sort((a, b) => a - b)[Math.floor(n / 2)]
  return {
    max: round(max),
    min: round(min),
    mean: round(mean),
    std: round(std),
    median: round(median),
  }
}

/** @param {number} n */
function round(n) {
  return +n.toFixed(2)
}

/** @param {number} port */
function printPort(port) {
  const vaporLink = !noVapor
    ? `\nVapor: ${colors.blue(`http://localhost:${port}/vapor`)}`
    : ''
  const vdomLink = vdom
    ? `\nvDom:  ${colors.blue(`http://localhost:${port}/vdom`)}`
    : ''
  console.info(`\n\nServer started at`, vaporLink, vdomLink)
}
