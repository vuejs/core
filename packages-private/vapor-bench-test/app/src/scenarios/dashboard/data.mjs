export const DASHBOARD_CONFIG = {
  cardCount: 12,
  tableCount: 3,
  rowsPerTable: 100,
}

const regions = ['North America', 'Europe', 'Asia Pacific']
const stages = ['Prospect', 'Qualified', 'Proposal', 'Negotiation', 'Won']
const owners = ['Ada', 'Brendan', 'Evan', 'Lea', 'Mira', 'Noah']
const segments = ['All', 'Enterprise', 'Growth', 'Strategic', 'Renewal', 'Risk']

export function createDashboardData() {
  const cards = Array.from({ length: DASHBOARD_CONFIG.cardCount }, (_, index) =>
    createCard(index),
  )
  const tables = Array.from(
    { length: DASHBOARD_CONFIG.tableCount },
    (_, tableIndex) => createTable(tableIndex),
  )
  const activity = Array.from({ length: 24 }, (_, index) => ({
    id: `activity-${index + 1}`,
    title: `Pipeline signal ${index + 1}`,
    account: `Account ${(index % 12) + 1}`,
    score: 68 + (index % 9),
  }))

  return {
    filters: segments.map((label, index) => ({
      id: label.toLowerCase(),
      label,
      active: index === 0,
    })),
    cards,
    tables,
    activity,
  }
}

export function computeDashboardSummary(dashboard) {
  const rows = dashboard.tables.flatMap(table => table.rows)
  const totalRevenue = rows.reduce((total, row) => total + row.revenue, 0)
  const totalScore = rows.reduce((total, row) => total + row.score, 0)
  const averageScore = Math.round((totalScore / rows.length) * 10) / 10
  const atRiskAccounts = rows.filter(row => row.score < 60).length

  return {
    totalRevenue,
    averageScore,
    atRiskAccounts,
    tableCount: dashboard.tables.length,
    rowCount: rows.length,
  }
}

function createCard(index) {
  const value = 1280 + index * 173 + (index % 3) * 41
  const delta = ((index % 5) - 2) * 3.2

  return {
    id: `card-${index + 1}`,
    label: `Metric ${index + 1}`,
    value,
    delta,
    tone: delta >= 0 ? 'positive' : 'negative',
  }
}

function createTable(tableIndex) {
  const rows = Array.from(
    { length: DASHBOARD_CONFIG.rowsPerTable },
    (_, index) => createRow(tableIndex, index),
  )

  return {
    id: `region-${tableIndex + 1}`,
    title: regions[tableIndex],
    rows,
  }
}

function createRow(tableIndex, index) {
  const score = 50 + ((index + tableIndex) % 50)

  return {
    id: `${tableIndex + 1}-${index + 1}`,
    account: `Account ${tableIndex + 1}-${index + 1}`,
    owner: owners[(index + tableIndex) % owners.length],
    stage: stages[(index * 3 + tableIndex) % stages.length],
    score,
    revenue: 1000 + tableIndex * 100 + index * 10,
    trend: (index % 9) - 4,
    stale: score < 60,
  }
}
