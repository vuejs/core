const TARGET_ORDER = ['vdom', 'vapor', 'solid']

export function createCodeSlopeSummary(samples) {
  const counts = uniqueSorted(samples.map(sample => sample.count))
  const targetIds = sortTargets(
    uniqueSorted(samples.map(sample => sample.target)),
  )
  const targets = {}

  for (const target of targetIds) {
    const points = counts.map(count =>
      createPoint(
        count,
        samples.filter(
          sample => sample.target === target && sample.count === count,
        ),
      ),
    )
    targets[target] = {
      points,
      slope: createSlope(points),
    }
  }

  return {
    counts,
    targets,
    comparisons: createComparisons(targets),
  }
}

export function estimateBreakEvenComponentCount(candidate, baseline) {
  const candidateSlope = candidate.bundleGzipPerComponent
  const baselineSlope = baseline.bundleGzipPerComponent
  const candidateAtOne = candidate.bundleGzipAtOne
  const baselineAtOne = baseline.bundleGzipAtOne

  if (candidateSlope <= baselineSlope) return Infinity
  if (candidateAtOne >= baselineAtOne) return 1

  const count =
    1 + (baselineAtOne - candidateAtOne) / (candidateSlope - baselineSlope)

  return Math.ceil(count)
}

function createPoint(count, samples) {
  if (samples.length === 0) {
    throw new Error(`Missing code slope sample for count ${count}`)
  }

  const bundleGzip = median(
    samples.map(sample => sample.bundleSize.totals.gzip),
  )
  const bundleRaw = median(samples.map(sample => sample.bundleSize.totals.raw))
  const bundleBrotli = median(
    samples.map(sample => sample.bundleSize.totals.brotli),
  )
  const generatedGzip = median(
    samples.map(sample => sample.bundleSize.generatedCode.totals.gzip),
  )
  const generatedRaw = median(
    samples.map(sample => sample.bundleSize.generatedCode.totals.raw),
  )
  const generatedBrotli = median(
    samples.map(sample => sample.bundleSize.generatedCode.totals.brotli),
  )
  const generatedModules = median(
    samples.map(sample => sample.bundleSize.generatedCode.modules.length),
  )
  const runtimeRenderedBytes = median(
    samples.map(sample => getRuntimeRenderedBytes(sample.bundleSize)),
  )
  const generatedRenderedBytes = median(
    samples.map(sample => getGeneratedRenderedBytes(sample.bundleSize)),
  )

  return {
    count,
    bundleRaw,
    bundleGzip,
    bundleBrotli,
    generatedRaw,
    generatedGzip,
    generatedBrotli,
    generatedModules,
    runtimeRenderedBytes,
    generatedRenderedBytes,
    generatedGzipPerComponent: round(generatedGzip / count, 1),
    generatedRenderedBytesPerComponent: round(
      generatedRenderedBytes / count,
      1,
    ),
    bundleGzipPerComponent: round(bundleGzip / count, 1),
  }
}

function createSlope(points) {
  const first = points[0]
  const last = points[points.length - 1]
  const span = last.count - first.count

  if (span === 0) {
    return {
      generatedRawPerComponent: round(last.generatedRaw / last.count, 1),
      generatedGzipPerComponent: round(last.generatedGzip / last.count, 1),
      generatedBrotliPerComponent: round(last.generatedBrotli / last.count, 1),
      generatedRenderedBytesPerComponent: round(
        last.generatedRenderedBytes / last.count,
        1,
      ),
      bundleGzipPerComponent: round(last.bundleGzip / last.count, 1),
      bundleGzipAtOne: last.bundleGzip,
      runtimeRenderedBytesAtMax: last.runtimeRenderedBytes,
      generatedModulesPerComponent: round(
        last.generatedModules / last.count,
        1,
      ),
    }
  }

  return {
    generatedRawPerComponent: round(
      (last.generatedRaw - first.generatedRaw) / span,
      1,
    ),
    generatedGzipPerComponent: round(
      (last.generatedGzip - first.generatedGzip) / span,
      1,
    ),
    generatedBrotliPerComponent: round(
      (last.generatedBrotli - first.generatedBrotli) / span,
      1,
    ),
    generatedRenderedBytesPerComponent: round(
      (last.generatedRenderedBytes - first.generatedRenderedBytes) / span,
      1,
    ),
    bundleGzipPerComponent: round(
      (last.bundleGzip - first.bundleGzip) / span,
      1,
    ),
    bundleGzipAtOne: first.bundleGzip,
    runtimeRenderedBytesAtMax: last.runtimeRenderedBytes,
    generatedModulesPerComponent: round(last.generatedModules / last.count, 1),
  }
}

function createComparisons(targets) {
  const comparisons = {}

  if (targets.vapor && targets.vdom) {
    comparisons.vaporVsVdom = compareTargetSlopes(
      targets.vapor.slope,
      targets.vdom.slope,
    )
  }
  if (targets.vapor && targets.solid) {
    comparisons.vaporVsSolid = compareTargetSlopes(
      targets.vapor.slope,
      targets.solid.slope,
    )
  }

  return comparisons
}

function compareTargetSlopes(candidate, baseline) {
  return {
    generatedGzipPerComponentPct: percentDiff(
      candidate.generatedGzipPerComponent,
      baseline.generatedGzipPerComponent,
    ),
    generatedRenderedBytesPerComponentPct: percentDiff(
      candidate.generatedRenderedBytesPerComponent,
      baseline.generatedRenderedBytesPerComponent,
    ),
    bundleGzipPerComponentPct: percentDiff(
      candidate.bundleGzipPerComponent,
      baseline.bundleGzipPerComponent,
    ),
    breakEvenComponentCount: estimateBreakEvenComponentCount(
      candidate,
      baseline,
    ),
  }
}

function getRuntimeRenderedBytes(bundleSize) {
  const buckets = bundleSize.attribution.buckets

  return (
    getBucketRenderedBytes(buckets, 'vapor-runtime') +
    getBucketRenderedBytes(buckets, 'vue-runtime') +
    getBucketRenderedBytes(buckets, 'solid-runtime')
  )
}

function getGeneratedRenderedBytes(bundleSize) {
  const generatedRenderedCode = bundleSize.generatedRenderedCode
  const totals = generatedRenderedCode && generatedRenderedCode.totals

  if (totals && typeof totals.renderedBytes === 'number') {
    return totals.renderedBytes
  }

  return getBucketRenderedBytes(
    bundleSize.attribution.buckets,
    'generated-component',
  )
}

function getBucketRenderedBytes(buckets, key) {
  const bucket = buckets[key]
  return bucket ? bucket.renderedBytes : 0
}

function sortTargets(targets) {
  return [...targets].sort((a, b) => {
    const aIndex = TARGET_ORDER.indexOf(a)
    const bIndex = TARGET_ORDER.indexOf(b)
    const normalizedAIndex = aIndex === -1 ? TARGET_ORDER.length : aIndex
    const normalizedBIndex = bIndex === -1 ? TARGET_ORDER.length : bIndex

    if (normalizedAIndex !== normalizedBIndex) {
      return normalizedAIndex - normalizedBIndex
    }

    return a.localeCompare(b)
  })
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b
    }

    return String(a).localeCompare(String(b))
  })
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 1) return sorted[middle]

  return (sorted[middle - 1] + sorted[middle]) / 2
}

function percentDiff(value, baseline) {
  if (baseline === 0) {
    return value === 0 ? 0 : Infinity
  }

  return round(((value - baseline) / baseline) * 100, 1)
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
