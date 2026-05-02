import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import puppeteer from 'puppeteer-core'
import {
  DASHBOARD_DEFAULT_RUNS,
  DASHBOARD_DEFAULT_WARMUP_RUNS,
  getFirstScreenUrl,
  getScenarioTargets,
  resolveScenario,
} from '../src/bench/targets.mjs'
import { renderFirstScreenReport } from '../src/bench/report.mjs'
import { renderOperationReport } from '../src/bench/operationReport.mjs'
import { createDashboardSchedule } from '../src/bench/schedule.mjs'
import {
  getLatestReportPath,
  getRunResultPath,
  resolveReportRunId,
} from '../src/bench/output.mjs'
import { summarizeTrace } from '../src/bench/trace.mjs'
import {
  createChromeLaunchOptions,
  resolveCpuThrottle,
  resolveHeadlessMode,
} from '../src/bench/browser.mjs'
import {
  createPlausibilitySummary,
  createRunStats,
} from '../src/bench/stats.mjs'

const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const distRoot = path.join(appRoot, 'dist')
const scenario = resolveScenario(process.env.BENCH_SCENARIO || 'dashboard')
const targets = getScenarioTargets(scenario.id)
const port = Number(process.env.BENCH_PORT || 4173)
const runs = Number(process.env.BENCH_RUNS || DASHBOARD_DEFAULT_RUNS)
const warmupRuns = Number(
  process.env.BENCH_WARMUP_RUNS || DASHBOARD_DEFAULT_WARMUP_RUNS,
)
const cpuThrottle = resolveCpuThrottle(process.env, scenario)
const traceStartWaitMs = 50
const postGcWaitMs = 50
const visualPauseMs = Number(process.env.BENCH_VISUAL_PAUSE_MS || 0)
const viewport = {
  width: Number(process.env.BENCH_VIEWPORT_WIDTH || 1440),
  height: Number(process.env.BENCH_VIEWPORT_HEIGHT || 900),
  deviceScaleFactor: Number(process.env.BENCH_DEVICE_SCALE_FACTOR || 1),
}
const chromePath =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const headless = resolveHeadlessMode(process.env)
const reportRunId = resolveReportRunId(process.env)
const traceCategories = [
  'devtools.timeline',
  'blink.user_timing',
  'v8',
  'disabled-by-default-v8.compile',
]

await assertBuildsExist()

const runId = new Date().toISOString().replace(/[:.]/g, '-')
const resultDir = getRunResultPath(appRoot, runId)
await fs.mkdir(resultDir, { recursive: true })

const bundleSize = await collectBundleSizes()
await fs.writeFile(
  path.join(resultDir, 'bundle-size.json'),
  `${JSON.stringify(bundleSize, null, 2)}\n`,
)

const server = await startServer()
console.info(`Chrome headless: ${headless}`)
console.info(
  `Viewport: ${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor}`,
)
const browser = await puppeteer.launch(
  createChromeLaunchOptions({ chromePath, headless }),
)

try {
  if (scenario.measurement === 'operations') {
    await runOperationScenario(browser, bundleSize, runId, resultDir)
  } else {
    await runFirstScreenScenario(browser, bundleSize, runId, resultDir)
  }
} finally {
  await browser.close()
  server.close()
}

async function runFirstScreenScenario(browser, bundleSize, runId, resultDir) {
  const runSummariesByTarget = Object.fromEntries(
    targets.map(target => [target.id, []]),
  )
  const schedule = createDashboardSchedule({
    targets,
    runs,
    warmupRuns,
  })

  for (const sample of schedule) {
    const runSummary = await measureSample(browser, sample, resultDir)
    if (runSummary) {
      runSummariesByTarget[sample.target.id].push(runSummary)
    }
  }

  const summaries = await writeTargetSummaries(runSummariesByTarget, resultDir)

  await fs.writeFile(
    path.join(resultDir, `${scenario.resultPrefix}-summary.json`),
    `${JSON.stringify({ runs, warmupRuns, summaries }, null, 2)}\n`,
  )
  const reportPath = getLatestReportPath(appRoot, scenario.id, reportRunId)
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(
    reportPath,
    renderFirstScreenReport({
      scenario,
      runId,
      summaries,
      bundleSize,
      runs,
      warmupRuns,
      cpuThrottle,
    }),
  )

  console.table(
    Object.fromEntries(
      Object.entries(summaries).map(([target, summary]) => [
        target,
        {
          busy: summary.median.trace.mainThreadBusyMs,
          script: summary.median.trace.scriptingMs,
          ready: summary.median.readyMs,
        },
      ]),
    ),
  )
  console.info(`Results written to ${path.relative(appRoot, resultDir)}`)
  console.info(`Report written to ${path.relative(appRoot, reportPath)}`)
}

async function measureSample(browser, sample, resultDir) {
  const context = await createFreshBrowserContext(browser)
  const page = await context.newPage()
  await configurePage(page)
  const client = await page.target().createCDPSession()
  let tracing = false

  try {
    await installBenchHelpers(page)
    await client.send('Network.enable')
    await client.send('Network.setCacheDisabled', { cacheDisabled: true })
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle })

    const traceEvents = []

    if (sample.phase === 'measure') {
      client.on('Tracing.dataCollected', event => {
        traceEvents.push(...event.value)
      })
      await client.send('Tracing.start', {
        categories: traceCategories.join(','),
        transferMode: 'ReportEvents',
      })
      tracing = true
      await wait(traceStartWaitMs)
    }

    await page.goto(getFirstScreenUrl(scenario.id, sample.target.id, port), {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    })
    await page.waitForFunction(() => window.__BENCH_READY__ === true, {
      timeout: 45000,
    })
    await waitForNextFrame(page)

    if (sample.phase === 'warmup') {
      return undefined
    }

    const browserTiming = await page.evaluate(() => {
      const ready = performance.getEntriesByName('bench:first-screen-ready')[0]
      const paintEntries = performance.getEntriesByType('paint')
      return {
        readyMs: ready ? ready.startTime : 0,
        paints: paintEntries.map(entry => ({
          name: entry.name,
          startTime: entry.startTime,
        })),
      }
    })
    await stopTracing(client)
    tracing = false

    const targetDir = path.join(resultDir, sample.target.id)
    await fs.mkdir(targetDir, { recursive: true })
    const tracePath = path.join(
      targetDir,
      `${scenario.resultPrefix}-run-${sample.run}.trace.json`,
    )
    await fs.writeFile(
      tracePath,
      `${JSON.stringify({ traceEvents }, null, 2)}\n`,
    )
    await pauseForVisualInspection(page)

    return {
      run: sample.run,
      round: sample.round,
      readyMs: round(browserTiming.readyMs),
      paints: browserTiming.paints,
      trace: summarizeTrace(traceEvents),
    }
  } finally {
    if (tracing) {
      await stopTracing(client).catch(() => {})
    }
    await context.close()
  }
}

async function runOperationScenario(browser, bundleSize, runId, resultDir) {
  const operations = await loadScenarioOperations()
  const runSummariesByOperation = Object.fromEntries(
    operations.map(operation => [
      operation.id,
      Object.fromEntries(targets.map(target => [target.id, []])),
    ]),
  )
  const schedule = createOperationSchedule({
    targets,
    operations,
    runs,
    warmupRuns,
  })

  for (const sample of schedule) {
    const runSummary = await measureOperationSample(browser, sample, resultDir)
    if (runSummary) {
      runSummariesByOperation[sample.operation.id][sample.target.id].push(
        runSummary,
      )
    }
  }

  const summaries = await writeOperationSummaries(
    runSummariesByOperation,
    operations,
    resultDir,
  )

  await fs.writeFile(
    path.join(resultDir, `${scenario.resultPrefix}-summary.json`),
    `${JSON.stringify({ runs, warmupRuns, operations, summaries }, null, 2)}\n`,
  )
  const reportPath = getLatestReportPath(appRoot, scenario.id, reportRunId)
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(
    reportPath,
    renderOperationReport({
      scenario,
      runId,
      runs,
      warmupRuns,
      cpuThrottle,
      operations,
      summaries,
      bundleSize,
    }),
  )

  for (const operation of operations) {
    console.info(operation.label)
    console.table(
      Object.fromEntries(
        Object.entries(summaries[operation.id]).map(([target, summary]) => [
          target,
          {
            busy: summary.median.trace.mainThreadBusyMs,
            script: summary.median.trace.scriptingMs,
          },
        ]),
      ),
    )
  }
  console.info(`Results written to ${path.relative(appRoot, resultDir)}`)
  console.info(`Report written to ${path.relative(appRoot, reportPath)}`)
}

async function measureOperationSample(browser, sample, resultDir) {
  const context = await createFreshBrowserContext(browser)
  const page = await context.newPage()
  await configurePage(page)
  const client = await page.target().createCDPSession()
  let tracing = false

  try {
    await installBenchHelpers(page)
    await client.send('Network.enable')
    await client.send('Network.setCacheDisabled', { cacheDisabled: true })
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle })

    await page.goto(getFirstScreenUrl(scenario.id, sample.target.id, port), {
      waitUntil: 'networkidle0',
      timeout: 45000,
    })
    await page.waitForFunction(() => window.__BENCH_READY__ === true, {
      timeout: 45000,
    })
    await waitForNextFrame(page)

    if (sample.phase === 'warmup') {
      await runBrowserOperationAndAssert(page, sample.operation.id)
      return undefined
    }

    const traceEvents = []
    const stateBefore = await readBrowserDomState(page)
    client.on('Tracing.dataCollected', event => {
      traceEvents.push(...event.value)
    })
    await client.send('Tracing.start', {
      categories: traceCategories.join(','),
      transferMode: 'ReportEvents',
    })
    tracing = true

    await wait(traceStartWaitMs)
    await forceBrowserGC(page)
    await waitInBrowser(page, postGcWaitMs)
    const operationResult = await runBrowserOperation(page, sample.operation.id)
    await stopTracing(client)
    tracing = false
    const stateAfter = await readBrowserDomState(page)
    await assertBrowserOperation(page, sample.operation.id)

    if (stateBefore === stateAfter) {
      throw new Error(
        `Operation "${sample.operation.id}" did not change DOM bench state`,
      )
    }

    const targetDir = path.join(
      resultDir,
      sample.target.id,
      sample.operation.id,
    )
    await fs.mkdir(targetDir, { recursive: true })
    const tracePath = path.join(
      targetDir,
      `${scenario.resultPrefix}-run-${sample.run}.trace.json`,
    )
    await fs.writeFile(
      tracePath,
      `${JSON.stringify({ traceEvents }, null, 2)}\n`,
    )
    await pauseForVisualInspection(page)

    return {
      run: sample.run,
      round: sample.round,
      operation: sample.operation.id,
      operationMs: operationResult.duration,
      stateBefore,
      stateAfter,
      traceWindow: operationResult.traceWindow,
      trace: summarizeTrace(traceEvents, {
        window: operationResult.traceWindow,
      }),
    }
  } finally {
    if (tracing) {
      await stopTracing(client).catch(() => {})
    }
    await context.close()
  }
}

async function runBrowserOperation(page, operationId) {
  const result = await page.evaluate(async id => {
    if (typeof window.__BENCH_RUN_OPERATION__ !== 'function') {
      throw new Error('Missing __BENCH_RUN_OPERATION__')
    }

    const prefix = `bench:operation:${id}:${performance.now()}`
    const start = `${prefix}:start`
    const end = `${prefix}:end`
    const settled = `${prefix}:settled`
    performance.mark(start)
    await window.__BENCH_RUN_OPERATION__(id)
    await Promise.resolve()
    performance.mark(end)
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })
    performance.mark(settled)
    performance.measure(`bench:operation:${id}`, start, end)
    const measures = performance.getEntriesByName(`bench:operation:${id}`)
    const measure = measures[measures.length - 1]

    return {
      duration: measure.duration,
      traceWindow: {
        startMark: start,
        endMark: settled,
      },
    }
  }, operationId)

  return {
    ...result,
    duration: round(result.duration),
  }
}

async function runBrowserOperationAndAssert(page, operationId) {
  const stateBefore = await readBrowserDomState(page)
  const result = await runBrowserOperation(page, operationId)
  const stateAfter = await readBrowserDomState(page)
  await assertBrowserOperation(page, operationId)

  if (stateBefore === stateAfter) {
    throw new Error(`Operation "${operationId}" did not change DOM bench state`)
  }

  return {
    ...result,
    stateBefore,
    stateAfter,
  }
}

async function readBrowserDomState(page) {
  return page.evaluate(() => readBenchDomState())
}

async function assertBrowserOperation(page, operationId) {
  await page.evaluate(id => {
    if (typeof window.__BENCH_ASSERT_OPERATION__ !== 'function') {
      throw new Error('Missing __BENCH_ASSERT_OPERATION__')
    }

    window.__BENCH_ASSERT_OPERATION__(id)
  }, operationId)
}

async function waitForNextFrame(page) {
  await page.evaluate(
    () =>
      new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      }),
  )
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function forceBrowserGC(page) {
  await page.evaluate(() => {
    if (typeof window.gc === 'function') {
      window.gc({
        type: 'major',
        execution: 'sync',
        flavor: 'last-resort',
      })
    }
  })
}

async function waitInBrowser(page, ms) {
  await page.evaluate(
    delay => new Promise(resolve => setTimeout(resolve, delay)),
    ms,
  )
}

async function pauseForVisualInspection(page) {
  if (visualPauseMs > 0) {
    await waitInBrowser(page, visualPauseMs)
  }
}

async function configurePage(page) {
  await page.setViewport(viewport)
}

async function installBenchHelpers(page) {
  await page.evaluateOnNewDocument(() => {
    window.readBenchDomState = () => {
      const marker = document.querySelector('[data-bench-state]')

      if (!marker) {
        throw new Error('Missing [data-bench-state] marker')
      }

      return marker.textContent || ''
    }
  })
}

async function loadScenarioOperations() {
  const module = await import(`../src/scenarios/${scenario.id}/data.mjs`)
  return module.OPERATIONS
}

function createOperationSchedule({ targets, operations, runs, warmupRuns }) {
  const schedule = []
  const measuredRuns = Object.fromEntries(
    operations.map(operation => [
      operation.id,
      Object.fromEntries(targets.map(target => [target.id, 0])),
    ]),
  )

  for (let roundIndex = 0; roundIndex < warmupRuns + runs; roundIndex++) {
    const phase = roundIndex < warmupRuns ? 'warmup' : 'measure'
    const round =
      phase === 'warmup' ? roundIndex + 1 : roundIndex - warmupRuns + 1
    const orderedTargets = rotateTargets(targets, roundIndex)

    for (const operation of operations) {
      for (const target of orderedTargets) {
        const sample = {
          phase,
          round,
          operation,
          target,
        }

        if (phase === 'measure') {
          measuredRuns[operation.id][target.id] += 1
          sample.run = measuredRuns[operation.id][target.id]
        }

        schedule.push(sample)
      }
    }
  }

  return schedule
}

function rotateTargets(items, roundIndex) {
  const offset = roundIndex % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

async function writeOperationSummaries(
  runSummariesByOperation,
  operations,
  resultDir,
) {
  const summaries = {}

  for (const operation of operations) {
    summaries[operation.id] = {}

    for (const target of targets) {
      const targetDir = path.join(resultDir, target.id, operation.id)
      await fs.mkdir(targetDir, { recursive: true })

      const summary = {
        operation: operation.id,
        target: target.id,
        label: target.label,
        runs: runSummariesByOperation[operation.id][target.id],
        median: medianSummary(runSummariesByOperation[operation.id][target.id]),
        stats: createRunStats(runSummariesByOperation[operation.id][target.id]),
        plausibility: createPlausibilitySummary(
          runSummariesByOperation[operation.id][target.id],
        ),
      }
      summaries[operation.id][target.id] = summary
      await fs.writeFile(
        path.join(targetDir, `${scenario.resultPrefix}-summary.json`),
        `${JSON.stringify(summary, null, 2)}\n`,
      )
    }
  }

  return summaries
}

async function writeTargetSummaries(runSummariesByTarget, resultDir) {
  const summaries = {}

  for (const target of targets) {
    const targetDir = path.join(resultDir, target.id)
    await fs.mkdir(targetDir, { recursive: true })

    const summary = {
      target: target.id,
      label: target.label,
      runs: runSummariesByTarget[target.id],
      median: medianSummary(runSummariesByTarget[target.id]),
      stats: createRunStats(runSummariesByTarget[target.id]),
      plausibility: createPlausibilitySummary(runSummariesByTarget[target.id]),
    }
    summaries[target.id] = summary
    await fs.writeFile(
      path.join(targetDir, `${scenario.resultPrefix}-summary.json`),
      `${JSON.stringify(summary, null, 2)}\n`,
    )
  }

  return summaries
}

async function createFreshBrowserContext(browser) {
  if (typeof browser.createBrowserContext === 'function') {
    return browser.createBrowserContext()
  }

  return browser.createIncognitoBrowserContext()
}

function medianSummary(runSummaries) {
  const sorted = [...runSummaries].sort(
    (a, b) => a.trace.mainThreadBusyMs - b.trace.mainThreadBusyMs,
  )
  return sorted[Math.floor(sorted.length / 2)]
}

async function stopTracing(client) {
  await new Promise(resolve => {
    client.once('Tracing.tracingComplete', resolve)
    client.send('Tracing.end')
  })
}

async function collectBundleSizes() {
  const sizes = {}

  for (const target of targets) {
    const dir = path.join(appRoot, target.distDir)
    const files = await listFiles(dir)
    const assetFiles = files.filter(file => /\.js$/.test(file))
    const totals = { raw: 0, gzip: 0, brotli: 0 }
    const assets = []

    for (const file of assetFiles) {
      const bytes = await fs.readFile(file)
      const asset = {
        file: path.relative(dir, file),
        raw: bytes.length,
        gzip: gzipSync(bytes).length,
        brotli: brotliCompressSync(bytes).length,
      }
      totals.raw += asset.raw
      totals.gzip += asset.gzip
      totals.brotli += asset.brotli
      assets.push(asset)
    }

    sizes[target.id] = {
      totals,
      assets,
    }
  }

  return sizes
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)))
    } else {
      files.push(fullPath)
    }
  }

  return files
}

async function assertBuildsExist() {
  for (const target of targets) {
    const indexPath = path.join(appRoot, target.distDir, 'index.html')
    await fs.access(indexPath)
  }
}

function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://127.0.0.1:${port}`)
      const pathname = decodeURIComponent(url.pathname)
      const route = resolveAssetRoute(pathname)

      if (!route) {
        response.writeHead(302, {
          location:
            scenario.id === 'dashboard' ? '/vdom/' : `/${scenario.id}/vdom/`,
        })
        response.end()
        return
      }

      const filePath = path.join(
        distRoot,
        ...route.distParts,
        route.assetPath || 'index.html',
      )
      const content = await fs.readFile(filePath)
      response.writeHead(200, { 'content-type': contentType(filePath) })
      response.end(content)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })

  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

function resolveAssetRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return null

  if (scenario.id === 'dashboard') {
    const [target, ...rest] = parts
    return {
      distParts: [target],
      assetPath: rest.join('/'),
    }
  }

  const [scenarioId, target, ...rest] = parts
  if (scenarioId !== scenario.id || !target) return null

  return {
    distParts:
      scenario.measurement === 'hydration-first-screen'
        ? [scenario.id, target, 'client']
        : [scenario.id, target],
    assetPath: rest.join('/'),
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

function round(value) {
  return Math.round(value * 100) / 100
}
