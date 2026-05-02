export const DYNAMIC_PROPS_ATTRS_CONFIG = {
  groupCount: 25,
  itemsPerGroup: 20,
}

export const DYNAMIC_PROPS_ATTRS_COUNT =
  DYNAMIC_PROPS_ATTRS_CONFIG.groupCount *
  DYNAMIC_PROPS_ATTRS_CONFIG.itemsPerGroup

export const DYNAMIC_PROPS_ATTRS_OPERATIONS = [
  {
    id: 'retarget-active-attrs',
    label: 'Retarget active attrs',
  },
  {
    id: 'update-fallthrough-attrs',
    label: 'Update fallthrough attrs',
  },
  {
    id: 'rotate-prop-bag',
    label: 'Rotate prop bag',
  },
]

export const OPERATIONS = DYNAMIC_PROPS_ATTRS_OPERATIONS

const STATUSES = ['new', 'queued', 'ready', 'blocked']
const TONES = ['neutral', 'success', 'warning', 'danger']

export function createAttrItems() {
  return Array.from({ length: DYNAMIC_PROPS_ATTRS_COUNT }, (_, id) => {
    const group = Math.floor(id / DYNAMIC_PROPS_ATTRS_CONFIG.itemsPerGroup)
    const index = id % DYNAMIC_PROPS_ATTRS_CONFIG.itemsPerGroup

    return {
      id,
      group,
      index,
      title: `Attr card ${group + 1}-${index + 1}`,
      owner: `Owner ${(id % 10) + 1}`,
      code: `DA-${String(id + 1).padStart(4, '0')}`,
      score: 25 + ((id * 17) % 75),
      status: STATUSES[id % STATUSES.length],
    }
  })
}

export function createAttrGroups(items) {
  return Array.from(
    { length: DYNAMIC_PROPS_ATTRS_CONFIG.groupCount },
    (_, group) => ({
      id: group,
      label: `Attr group ${group + 1}`,
      items: items.slice(
        group * DYNAMIC_PROPS_ATTRS_CONFIG.itemsPerGroup,
        (group + 1) * DYNAMIC_PROPS_ATTRS_CONFIG.itemsPerGroup,
      ),
    }),
  )
}

export function createDynamicPropBag(
  item,
  { activeId, attrRevision, variantSeed },
) {
  const active = item.id === activeId
  const tone = TONES[(item.id + variantSeed + 1) % TONES.length]
  const compact = (item.id + variantSeed) % 2 === 0
  const rank = String((item.score + attrRevision) % 100)
  const className = `parent-tone-${tone}${active ? ' parent-active' : ''}${
    compact ? ' parent-compact' : ''
  }`

  return {
    active,
    compact,
    tone,
    'aria-label': `${item.title} ${tone} revision ${attrRevision}`,
    'data-owner': item.owner,
    'data-rank': rank,
    'data-revision': String(attrRevision),
    title: `${item.code} ${tone}`,
    class: className,
    style: `--score:${item.score + attrRevision};--stripe:${
      (item.id + variantSeed) % 8
    }`,
  }
}

export function getNextActiveId(activeId) {
  return (activeId + 113) % DYNAMIC_PROPS_ATTRS_COUNT
}

export function getNextVariantSeed(seed) {
  return (seed + 1) % TONES.length
}
