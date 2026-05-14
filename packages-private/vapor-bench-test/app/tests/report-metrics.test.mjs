import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderFirstScreenReport } from '../src/bench/report.mjs'

test('first-screen report includes memory and code-size metrics', () => {
  const report = renderFirstScreenReport({
    scenario: {
      id: 'dashboard',
      reportTitle: 'Dashboard First Screen Report',
    },
    runId: 'run',
    runs: 3,
    warmupRuns: 1,
    cpuThrottle: 4,
    summaries: {
      vdom: summary('vdom', 'Vue VDOM', 12, 900_000),
      vapor: summary('vapor', 'Vue Vapor', 10, 700_000),
      solid: summary('solid', 'Solid', 11, 500_000),
    },
    bundleSize: {
      vdom: size(25_000),
      vapor: size(18_000),
      solid: size(7000),
    },
  })

  assert.match(report, /JS heap used median/)
  assert.match(report, /DOM nodes median/)
  assert.match(report, /Runtime \/ generated code split/)
  assert.match(report, /Generated component code size/)
  assert.match(report, /final rendered bytes/)
  assert.match(report, /\| vdom \| 6250 \| 3125 \| 1562.5 \| 1234 \|/)
})

function summary(target, label, busy, heap) {
  return {
    target,
    label,
    stats: {
      mainThreadBusyMs: metric(busy),
      scriptingMs: metric(4),
      renderingMs: metric(3),
      paintingMs: metric(2),
      readyMs: metric(20),
      memory: {
        jsHeapUsedBytes: metric(heap),
        nodes: metric(1000),
        jsEventListeners: metric(20),
      },
    },
    plausibility: {
      warnings: [],
      traceWarnings: [],
    },
  }
}

function size(gzip) {
  return {
    totals: {
      raw: gzip * 2,
      gzip,
      brotli: gzip / 2,
    },
    attribution: {
      totalRenderedBytes: gzip * 2,
      buckets: {
        'vapor-runtime': {
          renderedBytes: gzip,
          sharePct: 50,
        },
        'generated-component': {
          renderedBytes: gzip / 2,
          sharePct: 25,
        },
      },
    },
    generatedCode: {
      totals: {
        raw: gzip / 4,
        gzip: gzip / 8,
        brotli: gzip / 16,
      },
    },
    generatedRenderedCode: {
      totals: {
        renderedBytes: 1234,
      },
      modules: [],
    },
  }
}

function metric(median) {
  return {
    min: median,
    max: median,
    median,
    mean: median,
    stddev: 0,
    iqr: 0,
    mad: 0,
    relativeStddevPct: 0,
    values: [median],
  }
}
