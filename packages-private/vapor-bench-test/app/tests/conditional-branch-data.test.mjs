import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CONDITIONAL_BRANCH_CONFIG,
  CONDITIONAL_BRANCH_COUNT,
  CONDITIONAL_BRANCH_HOT_BRANCH,
  CONDITIONAL_BRANCH_HOT_GROUP,
  CONDITIONAL_BRANCH_OPERATIONS,
  createBranchGroups,
  createBranches,
  getAllBranchIndices,
  getGroupBranchIndices,
  toggleBranches,
} from '../src/scenarios/conditional-branch/data.mjs'

test('conditional branch data keeps a fixed branch workload', () => {
  const branches = createBranches()
  const groups = createBranchGroups(branches)

  assert.equal(CONDITIONAL_BRANCH_CONFIG.groupCount, 24)
  assert.equal(CONDITIONAL_BRANCH_CONFIG.branchesPerGroup, 20)
  assert.equal(CONDITIONAL_BRANCH_COUNT, 480)
  assert.equal(branches.length, 480)
  assert.equal(groups.length, 24)
  assert.equal(groups[0].branches.length, 20)
  assert.deepEqual(branches[0], {
    id: 0,
    group: 0,
    index: 0,
    title: 'Branch 1-1',
    owner: 'Owner 1',
    code: 'CB-0001',
    score: 40,
    delta: -9,
    load: '31%',
    expanded: true,
  })
})

test('conditional branch operations cover branch churn granularity', () => {
  assert.deepEqual(
    CONDITIONAL_BRANCH_OPERATIONS.map(operation => operation.id),
    ['toggle-one-branch', 'toggle-one-group', 'toggle-all-branches'],
  )
})

test('conditional branch index helpers are deterministic', () => {
  assert.equal(CONDITIONAL_BRANCH_HOT_BRANCH, 247)
  assert.equal(CONDITIONAL_BRANCH_HOT_GROUP, 12)
  assert.deepEqual(
    getGroupBranchIndices().slice(0, 5),
    [240, 241, 242, 243, 244],
  )
  assert.deepEqual(getAllBranchIndices().slice(-3), [477, 478, 479])
})

test('conditional branch toggles preserve unchanged branch identity', () => {
  const branches = createBranches()
  const updated = toggleBranches(branches, [247])

  assert.equal(updated[0], branches[0])
  assert.notEqual(updated[247], branches[247])
  assert.equal(updated[247].expanded, !branches[247].expanded)
})
