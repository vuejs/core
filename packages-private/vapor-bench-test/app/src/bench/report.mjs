import { BENCH_SCENARIOS } from './targets.mjs'

export function renderFirstScreenReport({
  scenario,
  runId,
  runs,
  warmupRuns,
  cpuThrottle,
  summaries,
  bundleSize,
}) {
  const targetSummaries = Object.values(summaries)
  const conclusion = buildConclusion(targetSummaries, summaries, bundleSize)
  const rows = targetSummaries
    .map(summary => {
      const stats = summary.stats
      const size = bundleSize[summary.target].totals
      return `| ${summary.label} | ${stats.mainThreadBusyMs.median} | ${stats.mainThreadBusyMs.iqr} | ${stats.mainThreadBusyMs.stddev} | ${stats.scriptingMs.median} | ${stats.renderingMs.median} | ${stats.paintingMs.median} | ${stats.readyMs.median} | ${size.raw} | ${size.gzip} | ${size.brotli} |`
    })
    .join('\n')
  const stabilityNotes = renderStabilityNotes(targetSummaries)

  return `# ${scenario.reportTitle}

Scenario: ${scenario.id}

Measurement: ${scenario.measurement || 'first-screen'}

Run: ${runId}

CPU throttle: ${cpuThrottle}x

Runs per target: ${runs}

Warmup runs per target: ${warmupRuns}

Sampling: ${warmupRuns} warmup rounds, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

${renderConclusions(conclusion)}

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | readyMs median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}
${stabilityNotes}
`
}

export function renderDashboardReport(options) {
  return renderFirstScreenReport({
    scenario: BENCH_SCENARIOS.dashboard,
    ...options,
  })
}

function buildConclusion(targetSummaries, summaries, bundleSize) {
  const fastestCpu = minBy(
    targetSummaries,
    summary => summary.stats.mainThreadBusyMs.median,
  )
  const cpuRank = [...targetSummaries].sort(
    (a, b) => a.stats.mainThreadBusyMs.median - b.stats.mainThreadBusyMs.median,
  )
  const cpuGap = percentDiff(
    cpuRank[0].stats.mainThreadBusyMs.median,
    cpuRank[1].stats.mainThreadBusyMs.median,
  )
  const smallestGzip = minBy(
    targetSummaries,
    summary => bundleSize[summary.target].totals.gzip,
  )
  const vapor = summaries.vapor
  const vdom = summaries.vdom
  const solid = summaries.solid

  return {
    cpuGap,
    fastestCpu,
    smallestGzip,
    targetSummaries,
    vapor,
    vdom,
    solid,
    bundleSize,
  }
}

function renderConclusions({
  cpuGap,
  fastestCpu,
  smallestGzip,
  vapor,
  vdom,
  solid,
  bundleSize,
}) {
  const cpuConclusion =
    Math.abs(cpuGap) < 5
      ? `mainThreadBusyMs median: fastest and second-fastest differ by ${formatPercent(Math.abs(cpuGap))}, below the 5.0% threshold; no first-screen CPU winner is declared.`
      : `Fastest mainThreadBusyMs median: ${fastestCpu.label} (${formatNumber(fastestCpu.stats.mainThreadBusyMs.median)}ms).`

  return `## Conclusion

- ${cpuConclusion}
- Smallest gzip JS: ${smallestGzip.label} (${formatBytes(bundleSize[smallestGzip.target].totals.gzip)}).
- ${vapor.label} vs ${vdom.label}: mainThreadBusyMs ${formatNoisyComparison(vapor.stats.mainThreadBusyMs.median, vdom.stats.mainThreadBusyMs.median)}; gzip JS ${formatPercentComparison(bundleSize.vapor.totals.gzip, bundleSize.vdom.totals.gzip)}; scriptingMs ${formatPercentComparison(vapor.stats.scriptingMs.median, vdom.stats.scriptingMs.median)}.
- ${vapor.label} vs ${solid.label}: mainThreadBusyMs ${formatNoisyComparison(vapor.stats.mainThreadBusyMs.median, solid.stats.mainThreadBusyMs.median)}; gzip JS ${formatPercentComparison(bundleSize.vapor.totals.gzip, bundleSize.solid.totals.gzip)}; scriptingMs ${formatPercentComparison(vapor.stats.scriptingMs.median, solid.stats.scriptingMs.median)}.`
}

function renderStabilityNotes(summaries) {
  const notes = summaries
    .map(summary => {
      const warnings = summary.plausibility?.warnings || []
      const traceWarnings = summary.plausibility?.traceWarnings || []
      const parts = []

      if (warnings.length > 0) {
        parts.push(warnings.join('; '))
      }
      if (traceWarnings.length > 0) {
        parts.push(`${traceWarnings.length} trace warning(s)`)
      }

      return parts.length > 0 ? `- ${summary.label}: ${parts.join('; ')}` : ''
    })
    .filter(Boolean)

  if (notes.length === 0) return ''

  return `

## Stability Notes

${notes.join('\n')}`
}

function minBy(items, getValue) {
  return items.reduce((currentMin, item) =>
    getValue(item) < getValue(currentMin) ? item : currentMin,
  )
}

function formatPercentComparison(value, baseline) {
  if (baseline === 0) {
    return value === 0 ? 'flat' : `increased from 0 to ${formatNumber(value)}`
  }

  const percent = percentDiff(value, baseline)
  const rounded = Math.round(percent * 10) / 10

  if (rounded === 0) {
    return 'flat'
  }

  return `${Math.abs(rounded).toFixed(1)}% ${rounded > 0 ? 'higher' : 'lower'}`
}

function formatNoisyComparison(value, baseline) {
  const percent = percentDiff(value, baseline)

  if (Math.abs(percent) < 5) {
    return `${formatPercent(Math.abs(percent))} difference, within noise threshold`
  }

  return formatPercentComparison(value, baseline)
}

function percentDiff(value, baseline) {
  if (baseline === 0) {
    return value === 0 ? 0 : Infinity
  }

  return ((value - baseline) / baseline) * 100
}

function formatPercent(value) {
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(value)
}
