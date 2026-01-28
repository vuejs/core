#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'

const start = performance.now()

const steps = [
  { cmd: 'tsc', args: ['-p', 'tsconfig.build.json', '--noCheck'] },
  { cmd: 'rollup', args: ['-c', 'rollup.dts.config.js'] },
]

for (const step of steps) {
  const result = spawnSync(step.cmd, step.args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log(`\ndts-tsc built in ${(performance.now() - start).toFixed(2)}ms.`)
