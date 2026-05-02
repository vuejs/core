import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  COMPONENT_FANOUT_CONFIG,
  COMPONENT_FANOUT_COUNT,
  COMPONENT_FANOUT_OPERATIONS,
  createFanoutGroups,
  createFanoutItems,
  getNextActiveId,
  getNextMode,
} from '../src/scenarios/component-fanout/data.mjs'

test('component fanout data keeps a fixed child component workload', () => {
  const items = createFanoutItems()
  const groups = createFanoutGroups(items)

  assert.equal(COMPONENT_FANOUT_CONFIG.groupCount, 30)
  assert.equal(COMPONENT_FANOUT_CONFIG.itemsPerGroup, 20)
  assert.equal(COMPONENT_FANOUT_COUNT, 600)
  assert.equal(items.length, 600)
  assert.equal(groups.length, 30)
  assert.equal(groups[0].items.length, 20)
  assert.deepEqual(items[0], {
    id: 0,
    group: 0,
    index: 0,
    title: 'Component 1-1',
    owner: 'Team 1',
    code: 'CF-0001',
    score: 30,
    status: 'queued',
  })
})

test('component fanout operations cover parent-to-child update shapes', () => {
  assert.deepEqual(
    COMPONENT_FANOUT_OPERATIONS.map(operation => operation.id),
    ['retarget-active-child', 'update-shared-revision', 'cycle-display-mode'],
  )
})

test('component fanout parent state helpers are deterministic', () => {
  assert.equal(getNextActiveId(0), 137)
  assert.equal(getNextActiveId(548), 85)
  assert.equal(getNextMode('steady'), 'busy')
  assert.equal(getNextMode('busy'), 'alert')
  assert.equal(getNextMode('alert'), 'steady')
})
