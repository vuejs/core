import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  STATIC_HEAVY_CONFIG,
  createStaticHeavyData,
} from '../src/scenarios/static-heavy/data.mjs'

test('static-heavy data keeps a large mostly-static first screen', () => {
  const data = createStaticHeavyData()

  assert.equal(STATIC_HEAVY_CONFIG.sectionCount, 100)
  assert.equal(STATIC_HEAVY_CONFIG.staticItemsPerSection, 20)
  assert.equal(data.metrics.length, 20)
  assert.equal(data.sections.length, 100)
  assert.equal(data.staticItems.length, 20)
})

test('static-heavy data is deterministic across runs', () => {
  assert.deepEqual(createStaticHeavyData(), createStaticHeavyData())
})
