import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveCpuThrottle } from '../src/bench/browser.mjs'

test('cpu throttle defaults to 10x for operation scenarios', () => {
  assert.equal(resolveCpuThrottle({}, { measurement: 'operations' }), 10)
})

test('cpu throttle defaults to 4x for first-screen scenarios', () => {
  assert.equal(resolveCpuThrottle({}, { measurement: 'first-screen' }), 4)
})

test('cpu throttle env override wins over scenario defaults', () => {
  assert.equal(
    resolveCpuThrottle(
      { BENCH_CPU_THROTTLE: '6' },
      { measurement: 'operations' },
    ),
    6,
  )
})
