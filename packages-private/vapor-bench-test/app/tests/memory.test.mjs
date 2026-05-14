import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryDelta } from '../src/bench/memory.mjs'
import { createRunStats } from '../src/bench/stats.mjs'

test('memory delta compares retained heap and DOM counters', () => {
  assert.deepEqual(
    createMemoryDelta(
      {
        jsHeapUsedBytes: 10_000,
        jsHeapTotalBytes: 20_000,
        documents: 1,
        nodes: 500,
        jsEventListeners: 25,
      },
      {
        jsHeapUsedBytes: 12_500,
        jsHeapTotalBytes: 24_000,
        documents: 1,
        nodes: 540,
        jsEventListeners: 30,
      },
    ),
    {
      jsHeapUsedBytes: 2500,
      jsHeapTotalBytes: 4000,
      documents: 0,
      nodes: 40,
      jsEventListeners: 5,
    },
  )
})

test('run stats include memory and operation memory deltas', () => {
  const runs = [
    sample(1, 100_000, 8000, 1200, 3),
    sample(2, 120_000, 9000, 1300, 5),
    sample(3, 140_000, 10_000, 1400, 7),
  ]

  const stats = createRunStats(runs)

  assert.equal(stats.memory.jsHeapUsedBytes.median, 120_000)
  assert.equal(stats.memory.nodes.median, 1300)
  assert.equal(stats.memoryDelta.jsHeapUsedBytes.median, 9000)
  assert.equal(stats.memoryDelta.jsEventListeners.median, 5)
})

function sample(run, heap, deltaHeap, nodes, deltaListeners) {
  return {
    run,
    readyMs: 10,
    memory: {
      jsHeapUsedBytes: heap,
      jsHeapTotalBytes: heap * 2,
      documents: 1,
      nodes,
      jsEventListeners: 20,
    },
    memoryDelta: {
      jsHeapUsedBytes: deltaHeap,
      jsHeapTotalBytes: deltaHeap * 2,
      documents: 0,
      nodes: 10,
      jsEventListeners: deltaListeners,
    },
    trace: {
      mainThreadBusyMs: 10 + run,
      scriptingMs: 4,
      renderingMs: 3,
      paintingMs: 2,
      warnings: [],
    },
  }
}
