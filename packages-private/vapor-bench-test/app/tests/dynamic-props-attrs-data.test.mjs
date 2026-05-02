import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DYNAMIC_PROPS_ATTRS_CONFIG,
  DYNAMIC_PROPS_ATTRS_COUNT,
  DYNAMIC_PROPS_ATTRS_OPERATIONS,
  createAttrGroups,
  createAttrItems,
  createDynamicPropBag,
  getNextActiveId,
  getNextVariantSeed,
} from '../src/scenarios/dynamic-props-attrs/data.mjs'

test('dynamic props attrs data keeps a fixed component workload', () => {
  const items = createAttrItems()
  const groups = createAttrGroups(items)

  assert.equal(DYNAMIC_PROPS_ATTRS_CONFIG.groupCount, 25)
  assert.equal(DYNAMIC_PROPS_ATTRS_CONFIG.itemsPerGroup, 20)
  assert.equal(DYNAMIC_PROPS_ATTRS_COUNT, 500)
  assert.equal(items.length, 500)
  assert.equal(groups.length, 25)
  assert.equal(groups[0].items.length, 20)
  assert.deepEqual(items[0], {
    id: 0,
    group: 0,
    index: 0,
    title: 'Attr card 1-1',
    owner: 'Owner 1',
    code: 'DA-0001',
    score: 25,
    status: 'new',
  })
})

test('dynamic props attrs operations cover prop and fallthrough updates', () => {
  assert.deepEqual(
    DYNAMIC_PROPS_ATTRS_OPERATIONS.map(operation => operation.id),
    ['retarget-active-attrs', 'update-fallthrough-attrs', 'rotate-prop-bag'],
  )
})

test('dynamic prop bags include declared props and fallthrough attrs', () => {
  const [item] = createAttrItems()
  const bag = createDynamicPropBag(item, {
    activeId: 0,
    attrRevision: 2,
    variantSeed: 1,
  })

  assert.equal(bag.active, true)
  assert.equal(bag.compact, false)
  assert.equal(bag.tone, 'warning')
  assert.equal(bag['data-rank'], '27')
  assert.equal(bag['aria-label'], 'Attr card 1-1 warning revision 2')
  assert.equal(bag.class, 'parent-tone-warning parent-active')
  assert.equal(bag.style, '--score:27;--stripe:1')
})

test('dynamic props attrs parent state helpers are deterministic', () => {
  assert.equal(getNextActiveId(0), 113)
  assert.equal(getNextActiveId(452), 65)
  assert.equal(getNextVariantSeed(0), 1)
  assert.equal(getNextVariantSeed(3), 0)
})
