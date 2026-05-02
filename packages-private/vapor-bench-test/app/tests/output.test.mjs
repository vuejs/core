import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReportRunId, getLatestReportPath } from '../src/bench/output.mjs'

test('report run id uses local date up to minute precision', () => {
  const date = new Date(2026, 3, 29, 8, 50, 42)

  assert.equal(createReportRunId(date), '20264290850')
})

test('report path stores report run id in flat file name', () => {
  assert.equal(
    getLatestReportPath('/repo/app', 'dashboard', '20264290850'),
    '/repo/app/reports/dashboard-report-20264290850.md',
  )
})
