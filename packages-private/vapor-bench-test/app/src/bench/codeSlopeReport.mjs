export function renderCodeSlopeReport({ summary, runId, runs }) {
  const vapor = summary.targets.vapor
  const vdom = summary.targets.vdom
  const solid = summary.targets.solid
  const vaporVsVdom = summary.comparisons.vaporVsVdom
  const vaporVsSolid = summary.comparisons.vaporVsSolid
  const breakEven = vaporVsVdom ? vaporVsVdom.breakEvenComponentCount : Infinity

  return `# Generated Code Slope Report

Run: ${runId}

Build rounds: ${runs}

Counts: ${summary.counts.join(', ')}

## Conclusion

- Vapor generated gzip per component: ${formatBytes(vapor.slope.generatedGzipPerComponent)}; VDOM generated gzip per component: ${formatBytes(vdom.slope.generatedGzipPerComponent)} (${formatPercentComparison(vaporVsVdom.generatedGzipPerComponentPct)}).
- Vapor final rendered generated code per component: ${formatBytes(vapor.slope.generatedRenderedBytesPerComponent)}; VDOM final rendered generated code per component: ${formatBytes(vdom.slope.generatedRenderedBytesPerComponent)} (${formatPercentComparison(vaporVsVdom.generatedRenderedBytesPerComponentPct)}).
- Vapor final bundle gzip per component: ${formatBytes(vapor.slope.bundleGzipPerComponent)}; VDOM final bundle gzip per component: ${formatBytes(vdom.slope.bundleGzipPerComponent)} (${formatPercentComparison(vaporVsVdom.bundleGzipPerComponentPct)}).
${renderSolidComparison(vapor, solid, vaporVsSolid)}
- ${formatBreakEven(breakEven)}

## Per-count Medians

${renderPointTable(summary)}

## Incremental Slope

${renderSlopeTable(summary)}
`
}

function renderSolidComparison(vapor, solid, comparison) {
  if (!solid || !comparison) return ''

  return `- Vapor vs Solid generated gzip per component: ${formatBytes(vapor.slope.generatedGzipPerComponent)} vs ${formatBytes(solid.slope.generatedGzipPerComponent)} (${formatPercentComparison(comparison.generatedGzipPerComponentPct)}).
- Vapor vs Solid final rendered generated code per component: ${formatBytes(vapor.slope.generatedRenderedBytesPerComponent)} vs ${formatBytes(solid.slope.generatedRenderedBytesPerComponent)} (${formatPercentComparison(comparison.generatedRenderedBytesPerComponentPct)}).
- Vapor vs Solid final bundle gzip per component: ${formatBytes(vapor.slope.bundleGzipPerComponent)} vs ${formatBytes(solid.slope.bundleGzipPerComponent)} (${formatPercentComparison(comparison.bundleGzipPerComponentPct)}).`
}

function renderPointTable(summary) {
  const rows = []

  for (const count of summary.counts) {
    const values = Object.entries(summary.targets)
      .map(([target, targetSummary]) => {
        const point = targetSummary.points.find(point => point.count === count)
        return `| ${count} | ${target} | ${formatBytes(point.generatedGzip)} | ${formatBytes(point.generatedRenderedBytes)} | ${formatBytes(point.bundleGzip)} | ${formatBytes(point.generatedGzipPerComponent)} | ${formatBytes(point.generatedRenderedBytesPerComponent)} | ${formatBytes(point.bundleGzipPerComponent)} | ${formatBytes(point.runtimeRenderedBytes)} |`
      })
      .join('\n')
    rows.push(values)
  }

  return `| components | target | generated gzip | final rendered generated | bundle gzip | generated gzip / component | final rendered generated / component | bundle gzip / component | runtime rendered bytes |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}`
}

function renderSlopeTable(summary) {
  const rows = Object.entries(summary.targets)
    .map(([target, targetSummary]) => {
      const slope = targetSummary.slope
      return `| ${target} | ${formatBytes(slope.generatedRawPerComponent)} | ${formatBytes(slope.generatedGzipPerComponent)} | ${formatBytes(slope.generatedBrotliPerComponent)} | ${formatBytes(slope.generatedRenderedBytesPerComponent)} | ${formatBytes(slope.bundleGzipPerComponent)} | ${formatBytes(slope.runtimeRenderedBytesAtMax)} | ${slope.generatedModulesPerComponent} |`
    })
    .join('\n')

  return `| target | generated raw / component | generated gzip / component | generated brotli / component | final rendered generated / component | bundle gzip / component | runtime rendered at max | generated modules / component |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}`
}

function formatBreakEven(value) {
  if (value === Infinity) {
    return 'No finite bundle gzip break-even: Vapor does not have a higher bundle gzip slope than VDOM in this range.'
  }

  return `Vapor has lower fixed bundle gzip but higher slope; estimated bundle gzip break-even: ${value} components.`
}

function formatPercentComparison(value) {
  if (value === Infinity) return 'higher from zero baseline'
  if (value === 0) return 'flat'

  return `${Math.abs(value).toFixed(1)}% ${value > 0 ? 'higher' : 'lower'}`
}

function formatBytes(value) {
  return `${value.toFixed(1)} bytes`
}
