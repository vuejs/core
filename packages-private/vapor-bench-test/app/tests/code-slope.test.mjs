import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCodeSlopeSummary,
  estimateBreakEvenComponentCount,
} from '../src/bench/codeSlope.mjs'
import { renderCodeSlopeReport } from '../src/bench/codeSlopeReport.mjs'

test('summarizes code slope medians and per-component growth', () => {
  const samples = [
    sample(1, 1, 'vdom', 1000, 300, 1000, 7000, 3000),
    sample(2, 1, 'vdom', 1010, 310, 1010, 7010, 3010),
    sample(3, 1, 'vdom', 990, 290, 990, 6990, 2990),
    sample(1, 500, 'vdom', 51000, 150000, 50900, 7000, 152700),
    sample(2, 500, 'vdom', 51010, 150010, 50910, 7010, 152710),
    sample(3, 500, 'vdom', 50990, 149990, 50890, 6990, 152690),
    sample(1, 1, 'vapor', 1100, 250, 1100, 5000, 2500),
    sample(2, 1, 'vapor', 1110, 260, 1110, 5010, 2510),
    sample(3, 1, 'vapor', 1090, 240, 1090, 4990, 2490),
    sample(1, 500, 'vapor', 101100, 125000, 100900, 5000, 127250),
    sample(2, 500, 'vapor', 101110, 125010, 100910, 5010, 127260),
    sample(3, 500, 'vapor', 101090, 124990, 100890, 4990, 127240),
  ]

  const summary = createCodeSlopeSummary(samples)

  assert.deepEqual(summary.counts, [1, 500])
  assert.equal(summary.targets.vdom.points[0].generatedGzip, 300)
  assert.equal(summary.targets.vdom.points[1].generatedGzip, 150000)
  assert.equal(summary.targets.vdom.slope.generatedGzipPerComponent, 300)
  assert.equal(
    summary.targets.vdom.slope.generatedRenderedBytesPerComponent,
    100,
  )
  assert.equal(summary.targets.vapor.slope.generatedGzipPerComponent, 250)
  assert.equal(
    summary.targets.vapor.slope.generatedRenderedBytesPerComponent,
    200,
  )
  assert.equal(summary.targets.vapor.slope.bundleGzipPerComponent, 250)
  assert.equal(
    summary.comparisons.vaporVsVdom.generatedGzipPerComponentPct,
    -16.7,
  )
  assert.equal(
    summary.comparisons.vaporVsVdom.generatedRenderedBytesPerComponentPct,
    100,
  )
  assert.equal(summary.comparisons.vaporVsVdom.bundleGzipPerComponentPct, -16.7)
})

test('estimates bundle break-even when Vapor has lower fixed cost but higher component slope', () => {
  const breakEven = estimateBreakEvenComponentCount(
    { bundleGzipAtOne: 1000, bundleGzipPerComponent: 30 },
    { bundleGzipAtOne: 2000, bundleGzipPerComponent: 20 },
  )

  assert.equal(breakEven, 101)
})

test('renders code slope report with slope and break-even conclusions', () => {
  const summary = createCodeSlopeSummary([
    sample(1, 1, 'vdom', 1000, 500, 1000, 8000, 4000),
    sample(1, 500, 'vdom', 51000, 50400, 51000, 8000, 53900),
    sample(1, 1, 'vapor', 1200, 400, 1100, 5000, 3000),
    sample(1, 500, 'vapor', 101000, 100200, 51100, 5000, 102800),
    sample(1, 1, 'solid', 800, 300, 900, 4000, 2000),
    sample(1, 500, 'solid', 75800, 75150, 100700, 4000, 51900),
  ])

  const report = renderCodeSlopeReport({
    summary,
    runId: 'code-slope-test',
    runs: 1,
  })

  assert.match(report, /# Generated Code Slope Report/)
  assert.match(report, /Vapor generated gzip per component: 200\.0 bytes/)
  assert.match(
    report,
    /Vapor final rendered generated code per component: 100\.2 bytes/,
  )
  assert.match(report, /VDOM generated gzip per component: 100\.0 bytes/)
  assert.match(
    report,
    /Vapor vs Solid generated gzip per component: 200\.0 bytes vs 150\.0 bytes \(33\.3% higher\)/,
  )
  assert.match(
    report,
    /Vapor vs Solid final rendered generated code per component: 100\.2 bytes vs 200\.0 bytes \(49\.9% lower\)/,
  )
  assert.match(
    report,
    /Vapor vs Solid final bundle gzip per component: 200\.0 bytes vs 100\.0 bytes \(100\.0% higher\)/,
  )
  assert.match(report, /estimated bundle gzip break-even: 11 components/)
})

function sample(
  run,
  count,
  target,
  generatedRaw,
  generatedGzip,
  generatedRenderedBytes,
  runtimeRenderedBytes,
  bundleGzip,
) {
  return {
    run,
    count,
    target,
    bundleSize: {
      totals: {
        raw: bundleGzip * 2,
        gzip: bundleGzip,
        brotli: Math.round(bundleGzip * 0.8),
      },
      attribution: {
        buckets: {
          'vapor-runtime': {
            renderedBytes: target === 'vapor' ? runtimeRenderedBytes : 0,
            modules: target === 'vapor' ? 1 : 0,
          },
          'vue-runtime': {
            renderedBytes: target === 'vdom' ? runtimeRenderedBytes : 0,
            modules: target === 'vdom' ? 4 : 0,
          },
          'solid-runtime': {
            renderedBytes: target === 'solid' ? runtimeRenderedBytes : 0,
            modules: target === 'solid' ? 2 : 0,
          },
          'generated-component': {
            renderedBytes: generatedRenderedBytes,
            modules: count,
          },
        },
      },
      generatedCode: {
        totals: {
          raw: generatedRaw,
          gzip: generatedGzip,
          brotli: Math.round(generatedGzip * 0.8),
        },
        modules: Array.from({ length: count }, (_, index) => ({
          id: `${target}-${index}`,
          raw: Math.round(generatedRaw / count),
          gzip: Math.round(generatedGzip / count),
          brotli: Math.round((generatedGzip * 0.8) / count),
          renderedBytes: Math.round(generatedRenderedBytes / count),
        })),
      },
      generatedRenderedCode: {
        totals: {
          renderedBytes: generatedRenderedBytes,
        },
        modules: Array.from({ length: count }, (_, index) => ({
          id: `${target}-${index}`,
          renderedBytes: Math.round(generatedRenderedBytes / count),
        })),
      },
    },
  }
}
