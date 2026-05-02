export const COMPONENT_FANOUT_CONFIG = {
  groupCount: 30,
  itemsPerGroup: 20,
}

export const COMPONENT_FANOUT_COUNT =
  COMPONENT_FANOUT_CONFIG.groupCount * COMPONENT_FANOUT_CONFIG.itemsPerGroup

export const COMPONENT_FANOUT_OPERATIONS = [
  {
    id: 'retarget-active-child',
    label: 'Retarget active child',
  },
  {
    id: 'update-shared-revision',
    label: 'Update shared revision',
  },
  {
    id: 'cycle-display-mode',
    label: 'Cycle display mode',
  },
]

export const OPERATIONS = COMPONENT_FANOUT_OPERATIONS

const STATUSES = ['queued', 'ready', 'running', 'blocked']
const MODES = ['steady', 'busy', 'alert']

export function createFanoutItems() {
  return Array.from({ length: COMPONENT_FANOUT_COUNT }, (_, id) => {
    const group = Math.floor(id / COMPONENT_FANOUT_CONFIG.itemsPerGroup)
    const index = id % COMPONENT_FANOUT_CONFIG.itemsPerGroup

    return {
      id,
      group,
      index,
      title: `Component ${group + 1}-${index + 1}`,
      owner: `Team ${(id % 10) + 1}`,
      code: `CF-${String(id + 1).padStart(4, '0')}`,
      score: 30 + ((id * 11) % 70),
      status: STATUSES[id % STATUSES.length],
    }
  })
}

export function createFanoutGroups(items) {
  return Array.from(
    { length: COMPONENT_FANOUT_CONFIG.groupCount },
    (_, group) => ({
      id: group,
      label: `Fanout group ${group + 1}`,
      items: items.slice(
        group * COMPONENT_FANOUT_CONFIG.itemsPerGroup,
        (group + 1) * COMPONENT_FANOUT_CONFIG.itemsPerGroup,
      ),
    }),
  )
}

export function getNextActiveId(activeId) {
  return (activeId + 137) % COMPONENT_FANOUT_COUNT
}

export function getNextMode(mode) {
  const index = MODES.indexOf(mode)
  return MODES[(index + 1) % MODES.length]
}
