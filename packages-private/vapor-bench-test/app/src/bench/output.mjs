import path from 'node:path'

export function getRunResultPath(appRoot, runId) {
  return path.join(appRoot, 'results', runId)
}

export function createReportRunId(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}${month}${day}${hour}${minute}`
}

export function resolveReportRunId(env = process.env) {
  return env.BENCH_REPORT_RUN_ID || createReportRunId()
}

export function getLatestReportPath(appRoot, scenarioId, reportRunId) {
  return path.join(appRoot, 'reports', `${scenarioId}-report-${reportRunId}.md`)
}
