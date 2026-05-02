import { spawn } from 'node:child_process'
import { createReportRunId } from '../src/bench/output.mjs'
import { BENCH_SCENARIOS } from '../src/bench/targets.mjs'

const reportRunId = process.env.BENCH_REPORT_RUN_ID || createReportRunId()
console.info(`Reports will be written as reports/*-report-${reportRunId}.md`)

for (const scenario of Object.values(BENCH_SCENARIOS)) {
  const script = `bench:${scenario.id}`
  console.info(`\n=== ${scenario.label} (${script}) ===`)
  await runPnpmScript(script)
}

function runPnpmScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['run', script], {
      stdio: 'inherit',
      env: {
        ...process.env,
        BENCH_REPORT_RUN_ID: reportRunId,
      },
    })

    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${script} exited with code ${code}`))
      }
    })
  })
}
