import { spawn } from 'node:child_process'
import { createReportRunId } from '../src/bench/output.mjs'
import { getMemoryScenarios } from '../src/bench/targets.mjs'

const reportRunId = process.env.BENCH_REPORT_RUN_ID || createReportRunId()
const rounds = Number(process.env.BENCH_MEMORY_ROUNDS || 3)

if (!Number.isInteger(rounds) || rounds <= 0) {
  throw new Error(
    `BENCH_MEMORY_ROUNDS must be a positive integer, got ${rounds}`,
  )
}

console.info(
  `Memory reports will be written as reports/*-report-${reportRunId}-rN.md`,
)

for (let round = 1; round <= rounds; round++) {
  const roundReportRunId = `${reportRunId}-r${round}`
  console.info(
    `\n=== Memory round ${round}/${rounds} (${roundReportRunId}) ===`,
  )

  for (const scenario of getMemoryScenarios()) {
    const script = `bench:${scenario.id}`
    console.info(`\n=== ${scenario.label} (${script}) ===`)
    await runPnpmScript(script, roundReportRunId)
  }
}

function runPnpmScript(script, roundReportRunId) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['run', script], {
      stdio: 'inherit',
      env: {
        ...process.env,
        BENCH_REPORT_RUN_ID: roundReportRunId,
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
