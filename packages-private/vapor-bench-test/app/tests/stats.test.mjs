import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMetricStats, createRunStats } from '../src/bench/stats.mjs'

test('metric stats include median and dispersion metrics', () => {
  assert.deepEqual(createMetricStats([10, 12, 14, 16, 100]), {
    min: 10,
    max: 100,
    median: 14,
    mean: 30.4,
    stddev: 38.97,
    iqr: 4,
    mad: 2,
    relativeStddevPct: 128.2,
    values: [10, 12, 14, 16, 100],
  })
})

test('run stats are derived from trace and browser timing samples', () => {
  const runs = [
    sample(1, 10, 4, 3, 2, 100),
    sample(2, 12, 5, 3, 2, 110),
    sample(3, 14, 6, 4, 2, 120),
  ]

  assert.deepEqual(createRunStats(runs), {
    mainThreadBusyMs: createMetricStats([10, 12, 14]),
    scriptingMs: createMetricStats([4, 5, 6]),
    renderingMs: createMetricStats([3, 3, 4]),
    paintingMs: createMetricStats([2, 2, 2]),
    longTaskCount: createMetricStats([0, 1, 2]),
    maxTaskMs: createMetricStats([40, 50, 60]),
    jsParseCompileMs: createMetricStats([1, 2, 3]),
    jsEvaluateMs: createMetricStats([2, 3, 4]),
    readyMs: createMetricStats([100, 110, 120]),
  })
})

function sample(run, busy, script, render, paint, ready) {
  return {
    run,
    readyMs: ready,
    trace: {
      mainThreadBusyMs: busy,
      scriptingMs: script,
      renderingMs: render,
      paintingMs: paint,
      longTaskCount: run - 1,
      maxTaskMs: 30 + run * 10,
      jsParseCompileMs: run,
      jsEvaluateMs: run + 1,
      warnings: [],
    },
  }
}
