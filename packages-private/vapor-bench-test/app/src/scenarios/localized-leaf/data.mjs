export const LOCALIZED_LEAF_CONFIG = {
  rows: 100,
  columns: 100,
}

export const LOCALIZED_LEAF_OPERATIONS = [
  {
    id: 'update-one-cell',
    label: 'Update one cell',
  },
  {
    id: 'update-row',
    label: 'Update row',
  },
  {
    id: 'update-1000-cells',
    label: 'Update 1,000 cells',
  },
]

export const OPERATIONS = LOCALIZED_LEAF_OPERATIONS

export function createCells() {
  return Array.from(
    { length: LOCALIZED_LEAF_CONFIG.rows * LOCALIZED_LEAF_CONFIG.columns },
    (_, id) => ({
      id,
      row: Math.floor(id / LOCALIZED_LEAF_CONFIG.columns),
      column: id % LOCALIZED_LEAF_CONFIG.columns,
      value: id,
    }),
  )
}

export function updateCells(cells, indices, delta) {
  const indexSet = new Set(indices)

  return cells.map(cell =>
    indexSet.has(cell.id) ? { ...cell, value: cell.value + delta } : cell,
  )
}

export function getRowIndices(row = 50) {
  return Array.from(
    { length: LOCALIZED_LEAF_CONFIG.columns },
    (_, column) => row * LOCALIZED_LEAF_CONFIG.columns + column,
  )
}

export function getThousandCellIndices() {
  return Array.from({ length: 1000 }, (_, index) => (index * 37) % 10000)
}
