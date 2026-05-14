const MEMORY_KEYS = [
  'jsHeapUsedBytes',
  'jsHeapTotalBytes',
  'documents',
  'nodes',
  'jsEventListeners',
]

export async function collectRetainedMemorySnapshot(page, client) {
  await forceGarbageCollection(page, client)

  const [heapUsage, domCounters] = await Promise.all([
    client.send('Runtime.getHeapUsage'),
    client.send('Memory.getDOMCounters'),
  ])

  return normalizeMemorySnapshot(heapUsage, domCounters)
}

export function createMemoryDelta(before, after) {
  const delta = {}

  for (const key of MEMORY_KEYS) {
    delta[key] = after[key] - before[key]
  }

  return delta
}

export function getMemoryMetricKeys() {
  return MEMORY_KEYS
}

function normalizeMemorySnapshot(heapUsage, domCounters) {
  return {
    jsHeapUsedBytes: heapUsage.usedSize,
    jsHeapTotalBytes: heapUsage.totalSize,
    documents: domCounters.documents,
    nodes: domCounters.nodes,
    jsEventListeners: domCounters.jsEventListeners,
  }
}

async function forceGarbageCollection(page, client) {
  await page.evaluate(() => {
    if (typeof window.gc === 'function') {
      window.gc({
        type: 'major',
        execution: 'sync',
        flavor: 'last-resort',
      })
    }
  })
  await client.send('HeapProfiler.collectGarbage').catch(() => {})
}
