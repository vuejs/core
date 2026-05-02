export const CONDITIONAL_BRANCH_CONFIG = {
  groupCount: 24,
  branchesPerGroup: 20,
}

export const CONDITIONAL_BRANCH_COUNT =
  CONDITIONAL_BRANCH_CONFIG.groupCount *
  CONDITIONAL_BRANCH_CONFIG.branchesPerGroup

export const CONDITIONAL_BRANCH_HOT_BRANCH = 247
export const CONDITIONAL_BRANCH_HOT_GROUP = 12

export const CONDITIONAL_BRANCH_OPERATIONS = [
  {
    id: 'toggle-one-branch',
    label: 'Toggle one branch',
  },
  {
    id: 'toggle-one-group',
    label: 'Toggle one group',
  },
  {
    id: 'toggle-all-branches',
    label: 'Toggle all branches',
  },
]

export const OPERATIONS = CONDITIONAL_BRANCH_OPERATIONS

export function createBranches() {
  return Array.from({ length: CONDITIONAL_BRANCH_COUNT }, (_, id) => {
    const group = Math.floor(id / CONDITIONAL_BRANCH_CONFIG.branchesPerGroup)
    const index = id % CONDITIONAL_BRANCH_CONFIG.branchesPerGroup
    const score = 40 + ((id * 13) % 61)
    const delta = ((id * 7) % 19) - 9

    return {
      id,
      group,
      index,
      title: `Branch ${group + 1}-${index + 1}`,
      owner: `Owner ${(id % 12) + 1}`,
      code: `CB-${String(id + 1).padStart(4, '0')}`,
      score,
      delta,
      load: `${(score + delta + 100) % 100}%`,
      expanded: id % 3 === 0,
    }
  })
}

export function createBranchGroups(branches) {
  return Array.from(
    { length: CONDITIONAL_BRANCH_CONFIG.groupCount },
    (_, group) => ({
      id: group,
      label: `Group ${group + 1}`,
      branches: branches.slice(
        group * CONDITIONAL_BRANCH_CONFIG.branchesPerGroup,
        (group + 1) * CONDITIONAL_BRANCH_CONFIG.branchesPerGroup,
      ),
    }),
  )
}

export function getGroupBranchIndices(group = CONDITIONAL_BRANCH_HOT_GROUP) {
  return Array.from(
    { length: CONDITIONAL_BRANCH_CONFIG.branchesPerGroup },
    (_, index) => group * CONDITIONAL_BRANCH_CONFIG.branchesPerGroup + index,
  )
}

export function getAllBranchIndices() {
  return Array.from({ length: CONDITIONAL_BRANCH_COUNT }, (_, index) => index)
}

export function toggleBranches(branches, indices) {
  const indexSet = new Set(indices)

  return branches.map(branch =>
    indexSet.has(branch.id)
      ? {
          ...branch,
          expanded: !branch.expanded,
        }
      : branch,
  )
}
