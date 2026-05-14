import { getMemoryMetricKeys } from './memory.mjs'

export function createRunStats(runs) {
  const stats = {
    mainThreadBusyMs: createMetricStats(
      runs.map(run => run.trace.mainThreadBusyMs),
    ),
    scriptingMs: createMetricStats(runs.map(run => run.trace.scriptingMs)),
    renderingMs: createMetricStats(runs.map(run => run.trace.renderingMs)),
    paintingMs: createMetricStats(runs.map(run => run.trace.paintingMs)),
  }

  for (const key of [
    'longTaskCount',
    'maxTaskMs',
    'jsParseCompileMs',
    'jsEvaluateMs',
  ]) {
    if (runs.every(run => typeof run.trace[key] === 'number')) {
      stats[key] = createMetricStats(runs.map(run => run.trace[key]))
    }
  }

  if (runs.every(run => typeof run.readyMs === 'number')) {
    stats.readyMs = createMetricStats(runs.map(run => run.readyMs))
  }
  if (runs.every(run => typeof run.operationMs === 'number')) {
    stats.operationMs = createMetricStats(runs.map(run => run.operationMs))
  }
  if (runs.every(run => run.memory)) {
    stats.memory = createMemoryStats(runs.map(run => run.memory))
  }
  if (runs.every(run => run.memoryDelta)) {
    stats.memoryDelta = createMemoryStats(runs.map(run => run.memoryDelta))
  }

  return stats
}

export function createMetricStats(values) {
  if (values.length === 0) {
    throw new Error('Cannot compute stats for empty values')
  }

  const sorted = [...values].sort((a, b) => a - b)
  const median = medianOfSorted(sorted)
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length
  const stddev =
    sorted.length === 1
      ? 0
      : Math.sqrt(
          sorted.reduce(
            (total, value) => total + Math.pow(value - mean, 2),
            0,
          ) /
            (sorted.length - 1),
        )
  const lower = sorted.slice(0, Math.floor(sorted.length / 2) + 1)
  const upper = sorted.slice(Math.floor(sorted.length / 2))
  const q1 = lower.length > 0 ? medianOfSorted(lower) : median
  const q3 = upper.length > 0 ? medianOfSorted(upper) : median
  const deviations = sorted
    .map(value => Math.abs(value - median))
    .sort((a, b) => a - b)
  const mad = medianOfSorted(deviations)

  return {
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    median: round(median),
    mean: round(mean),
    stddev: round(stddev),
    iqr: round(q3 - q1),
    mad: round(mad),
    relativeStddevPct: round(mean === 0 ? 0 : (stddev / mean) * 100),
    values: sorted.map(round),
  }
}

export function createPlausibilitySummary(runs) {
  const traceWarnings = []
  const busyStats = createMetricStats(
    runs.map(run => run.trace.mainThreadBusyMs),
  )
  const warnings = []

  for (const run of runs) {
    for (const warning of run.trace.warnings || []) {
      traceWarnings.push({
        run: run.run,
        warning,
      })
    }
  }

  if (busyStats.relativeStddevPct >= 15) {
    warnings.push(
      `mainThreadBusyMs relative stddev is ${busyStats.relativeStddevPct}%`,
    )
  }

  for (const run of runs) {
    const delta = Math.abs(run.trace.mainThreadBusyMs - busyStats.median)
    const threshold = Math.max(5, busyStats.mad * 3)

    if (delta > threshold) {
      warnings.push(
        `run ${run.run} mainThreadBusyMs ${run.trace.mainThreadBusyMs}ms is far from median ${busyStats.median}ms`,
      )
    }
  }

  return {
    warnings,
    traceWarnings,
  }
}

function createMemoryStats(snapshots) {
  return Object.fromEntries(
    getMemoryMetricKeys().map(key => [
      key,
      createMetricStats(snapshots.map(snapshot => snapshot[key])),
    ]),
  )
}

function medianOfSorted(sorted) {
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function round(value) {
  return Math.round(value * 100) / 100
}
