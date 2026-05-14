export function renderOperationReport({
  scenario,
  runId,
  runs,
  warmupRuns,
  cpuThrottle,
  operations,
  summaries,
  bundleSize,
}) {
  const sections = operations
    .map(operation =>
      renderOperationSection(operation, summaries[operation.id], bundleSize),
    )
    .join('\n\n')
  const conclusion = renderConclusion(operations, summaries)
  const codeSizeSections = renderCodeSizeSections(bundleSize)

  return `# ${scenario.reportTitle}

Scenario: ${scenario.id}

Run: ${runId}

CPU throttle: ${cpuThrottle}x

Runs per target: ${runs}

Warmup runs per target: ${warmupRuns}

Sampling: ${warmupRuns} warmup rounds per operation, round-robin target order, fresh browser context per sample

Primary timing metric: mainThreadBusyMs

Trace window: operation start through two animation frames after DOM settle. operationMs is the start-to-update browser measure before the settle wait.

## Conclusion

${conclusion}

${codeSizeSections}

${sections}
`
}

function renderConclusion(operations, summaries) {
  const vdomResults = operations.map(operation =>
    classifyComparison(
      summaries[operation.id].vapor.stats.mainThreadBusyMs.median,
      summaries[operation.id].vdom.stats.mainThreadBusyMs.median,
    ),
  )
  const solidResults = operations.map(operation =>
    classifyComparison(
      summaries[operation.id].vapor.stats.mainThreadBusyMs.median,
      summaries[operation.id].solid.stats.mainThreadBusyMs.median,
    ),
  )

  return [
    `- Vapor vs VDOM: ${formatOutcomeSummary(vdomResults, 'VDOM')}.`,
    `- Vapor vs Solid: ${formatOutcomeSummary(solidResults, 'Solid')}.`,
    `- Scenario conclusion: ${formatScenarioConclusion(vdomResults, solidResults)}.`,
  ].join('\n')
}

function renderOperationSection(operation, summaries, bundleSize) {
  const rows = Object.values(summaries)
    .map(summary => {
      const stats = summary.stats
      const size = bundleSize[summary.target].totals
      return `| ${summary.label} | ${stats.mainThreadBusyMs.median} | ${stats.mainThreadBusyMs.iqr} | ${stats.mainThreadBusyMs.stddev} | ${stats.scriptingMs.median} | ${stats.renderingMs.median} | ${stats.paintingMs.median} | ${formatStatMetric(stats, 'longTaskCount')} | ${formatStatMetric(stats, 'maxTaskMs')} | ${formatStatMetric(stats, 'jsParseCompileMs')} | ${formatStatMetric(stats, 'jsEvaluateMs')} | ${stats.operationMs.median} | ${formatMemoryMetric(stats, 'jsHeapUsedBytes')} | ${formatMemoryDeltaMetric(stats, 'jsHeapUsedBytes')} | ${formatMemoryMetric(stats, 'nodes')} | ${formatMemoryDeltaMetric(stats, 'nodes')} | ${size.raw} | ${size.gzip} | ${size.brotli} |`
    })
    .join('\n')
  const stabilityNotes = renderStabilityNotes(Object.values(summaries))

  const vapor = summaries.vapor
  const vdom = summaries.vdom
  const solid = summaries.solid

  return `## Operation: ${operation.label}

- Vapor vs VDOM: mainThreadBusyMs ${formatNoisyComparison(vapor.stats.mainThreadBusyMs.median, vdom.stats.mainThreadBusyMs.median)}; scriptingMs ${formatScriptComparison(vapor.stats.scriptingMs.median, vdom.stats.scriptingMs.median)}.
- Vapor vs Solid: mainThreadBusyMs ${formatNoisyComparison(vapor.stats.mainThreadBusyMs.median, solid.stats.mainThreadBusyMs.median)}; scriptingMs ${formatScriptComparison(vapor.stats.scriptingMs.median, solid.stats.scriptingMs.median)}.

| Target | mainThreadBusyMs median | busy IQR | busy stddev | scriptingMs median | renderingMs median | paintingMs median | long tasks median | max task median | JS parse/compile median | JS evaluate median | operationMs median | JS heap used median | JS heap delta median | DOM nodes median | DOM nodes delta median | JS raw bytes | JS gzip bytes | JS brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}${stabilityNotes}`
}

function renderStabilityNotes(summaries) {
  const notes = summaries
    .map(summary => {
      const plausibility = summary.plausibility || {}
      const warnings = plausibility.warnings || []
      const traceWarnings = plausibility.traceWarnings || []
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

### Stability Notes

${notes.join('\n')}`
}

function formatScriptComparison(value, baseline) {
  if (value < 1 && baseline < 1) {
    return 'both below 1ms'
  }
  if (baseline === 0) {
    return `increased from 0ms to ${formatNumber(value)}ms`
  }

  return formatPercentComparison(value, baseline)
}

function renderCodeSizeSections(bundleSize) {
  const targetEntries = Object.entries(bundleSize)
  const attributionRows = targetEntries
    .filter(([, size]) => size.attribution)
    .map(([target, size]) => {
      const buckets = size.attribution.buckets
      return `| ${target} | ${formatAttributionBucket(buckets['vapor-runtime'])} | ${formatAttributionBucket(buckets['vue-runtime'])} | ${formatAttributionBucket(buckets['solid-runtime'])} | ${formatAttributionBucket(buckets['generated-component'])} | ${formatAttributionBucket(buckets['scenario-user-code'])} |`
    })
    .join('\n')
  const generatedRows = targetEntries
    .filter(([, size]) => size.generatedCode)
    .map(([target, size]) => {
      const totals = size.generatedCode.totals
      return `| ${target} | ${totals.raw} | ${totals.gzip} | ${totals.brotli} | ${formatGeneratedRenderedBytes(size)} |`
    })
    .join('\n')
  const sections = []

  if (attributionRows) {
    sections.push(`## Runtime / generated code split

Rendered bytes are attributed from bundler module metadata. Gzip is reported only for whole assets because per-bucket gzip is not additive.

| Target | Vapor runtime | Vue runtime | Solid runtime | Generated component | Scenario user code |
| --- | ---: | ---: | ---: | ---: | ---: |
${attributionRows}`)
  }
  if (generatedRows) {
    sections.push(`## Generated component code size

Post-transform component module output before final bundling, plus final rendered generated module bytes after bundler/minifier output.

| Target | raw bytes | gzip bytes | brotli bytes | final rendered bytes |
| --- | ---: | ---: | ---: | ---: |
${generatedRows}`)
  }

  return sections.join('\n\n')
}

function formatAttributionBucket(bucket) {
  if (!bucket || bucket.renderedBytes === 0) return '0 (0.0%)'

  return `${bucket.renderedBytes} (${bucket.sharePct.toFixed(1)}%)`
}

function formatGeneratedRenderedBytes(size) {
  const generatedRenderedCode = size.generatedRenderedCode
  const totals = generatedRenderedCode && generatedRenderedCode.totals

  if (!totals || typeof totals.renderedBytes !== 'number') return '-'

  return String(totals.renderedBytes)
}

function formatMemoryMetric(stats, key) {
  const memory = stats.memory
  const metric = memory && memory[key]
  const value = metric && metric.median

  if (typeof value !== 'number') return '-'
  if (key.includes('Bytes')) return formatBytes(value)

  return String(value)
}

function formatMemoryDeltaMetric(stats, key) {
  const memoryDelta = stats.memoryDelta
  const metric = memoryDelta && memoryDelta[key]
  const value = metric && metric.median

  if (typeof value !== 'number') return '-'
  if (key.includes('Bytes')) return formatBytes(value)

  return String(value)
}

function formatStatMetric(stats, key) {
  const metric = stats[key]
  const value = metric && metric.median

  return typeof value === 'number' ? String(value) : '-'
}

function formatOutcomeSummary(results, baselineLabel) {
  const total = results.length
  const better = results.filter(result => result === 'better').length
  const worse = results.filter(result => result === 'worse').length
  const noise = results.filter(result => result === 'noise').length
  const parts = []

  if (better > 0) {
    parts.push(`${better}/${total} operations faster than ${baselineLabel}`)
  }
  if (worse > 0) {
    parts.push(`${worse}/${total} operations slower than ${baselineLabel}`)
  }
  if (noise > 0) {
    parts.push(`${noise}/${total} operations within noise threshold`)
  }

  return parts.join(', ')
}

function formatScenarioConclusion(vdomResults, solidResults) {
  const vdomWorse = vdomResults.includes('worse')
  const vdomBetter = vdomResults.includes('better')
  const solidWorse = solidResults.includes('worse')
  const solidBetter = solidResults.includes('better')

  if (!vdomWorse && solidBetter && !solidWorse) {
    return 'Vapor shows no observed disadvantage against VDOM and is faster than Solid in at least one operation'
  }
  if (!vdomWorse && !solidWorse) {
    return 'Vapor shows no clear observed disadvantage against VDOM or Solid'
  }
  if (vdomBetter && solidWorse) {
    return 'Vapor improves over VDOM, but still has operations behind Solid'
  }
  if (vdomWorse) {
    return 'Vapor has operations slower than VDOM in this scenario and needs further breakdown'
  }

  return 'Vapor mostly falls around the noise threshold'
}

function classifyComparison(value, baseline) {
  const percent = percentDiff(value, baseline)

  if (percent <= -5) {
    return 'better'
  }
  if (percent >= 5) {
    return 'worse'
  }

  return 'noise'
}

function formatPercentComparison(value, baseline) {
  if (baseline === 0) {
    return value === 0
      ? 'flat'
      : `increased from 0ms to ${formatNumber(value)}ms`
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
