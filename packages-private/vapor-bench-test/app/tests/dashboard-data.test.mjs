import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DASHBOARD_CONFIG,
  computeDashboardSummary,
  createDashboardData,
} from '../src/scenarios/dashboard/data.mjs'

test('dashboard data keeps the first-screen workload shape deterministic', () => {
  const dashboard = createDashboardData()

  assert.equal(DASHBOARD_CONFIG.cardCount, 12)
  assert.equal(DASHBOARD_CONFIG.tableCount, 3)
  assert.equal(DASHBOARD_CONFIG.rowsPerTable, 100)
  assert.equal(dashboard.cards.length, 12)
  assert.deepEqual(
    dashboard.tables.map(table => table.rows.length),
    [100, 100, 100],
  )
  assert.deepEqual(dashboard, createDashboardData())
})

test('dashboard summary derives stable first-screen headline metrics', () => {
  const summary = computeDashboardSummary(createDashboardData())

  assert.deepEqual(summary, {
    totalRevenue: 478500,
    averageScore: 74.5,
    atRiskAccounts: 60,
    tableCount: 3,
    rowCount: 300,
  })
})
