import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LOCALIZED_LEAF_CONFIG,
  LOCALIZED_LEAF_OPERATIONS,
  createCells,
  getThousandCellIndices,
  updateCells,
} from '../src/scenarios/localized-leaf/data.mjs'

test('localized leaf data keeps a 100x100 cell workload', () => {
  const cells = createCells()

  assert.equal(LOCALIZED_LEAF_CONFIG.rows, 100)
  assert.equal(LOCALIZED_LEAF_CONFIG.columns, 100)
  assert.equal(cells.length, 10000)
  assert.deepEqual(cells[0], {
    id: 0,
    row: 0,
    column: 0,
    value: 0,
  })
  assert.deepEqual(cells.at(-1), {
    id: 9999,
    row: 99,
    column: 99,
    value: 9999,
  })
})

test('localized leaf operations cover one, row, and thousand-cell updates', () => {
  assert.deepEqual(
    LOCALIZED_LEAF_OPERATIONS.map(operation => operation.id),
    ['update-one-cell', 'update-row', 'update-1000-cells'],
  )
})

test('localized leaf update helpers preserve unchanged cell identity', () => {
  const cells = createCells()
  const updated = updateCells(cells, [5050], 1)

  assert.equal(updated[0], cells[0])
  assert.notEqual(updated[5050], cells[5050])
  assert.deepEqual(updated[5050], {
    id: 5050,
    row: 50,
    column: 50,
    value: 5051,
  })
})

test('localized leaf thousand-cell indices are deterministic', () => {
  const indices = getThousandCellIndices()

  assert.equal(indices.length, 1000)
  assert.equal(new Set(indices).size, 1000)
  assert.deepEqual(indices.slice(0, 5), [0, 37, 74, 111, 148])
})
