#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const runsArgIndex = args.findIndex(arg => arg === '--runs' || arg === '-n')
const warmupArgIndex = args.findIndex(arg => arg === '--warmup' || arg === '-w')
const runs =
  runsArgIndex >= 0
    ? Number(args[runsArgIndex + 1])
    : Number(process.env.RUNS || 10)
const warmup =
  warmupArgIndex >= 0
    ? Number(args[warmupArgIndex + 1])
    : Number(process.env.WARMUP || 5)
const quiet = args.includes('--quiet')

if (!Number.isFinite(runs) || runs <= 0) {
  console.error('Invalid runs value. Use --runs <number> or set RUNS.')
  process.exit(1)
}

if (!Number.isFinite(warmup) || warmup < 0) {
  console.error('Invalid warmup value. Use --warmup <number> or set WARMUP.')
  process.exit(1)
}

const cases = [
  {
    title: 'build vs build-rollup',
    a: {
      label: 'build',
      cmd: 'node',
      args: ['scripts/build.js'],
    },
    b: {
      label: 'build-rollup',
      cmd: 'node',
      args: ['scripts/build-with-rollup.js'],
    },
  },
  {
    title: 'build-dts vs build-dts-tsc',
    a: { label: 'build-dts', cmd: 'node', args: ['scripts/build-types.js'] },
    b: {
      label: 'build-dts-tsc',
      cmd: 'node',
      args: ['scripts/build-dts-tsc.js'],
    },
  },
]

function extractBuiltInMs(output) {
  const cleaned = output.replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ')
  const matches = [...cleaned.matchAll(/built in\s+([\d.]+)ms/gi)]
  if (!matches.length) return null
  return matches.reduce((sum, match) => sum + Number(match[1]), 0)
}

function runOnce(command, commandArgs, label, index) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
  })

  if (!quiet) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status} on run ${index + 1}`,
    )
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const builtInMs = extractBuiltInMs(output)
  if (!Number.isFinite(builtInMs)) {
    const lines = output.trim().split(/\r?\n/)
    const tail = lines.slice(-20).join('\n')
    throw new Error(
      `${label} did not emit a "built in <ms>" timing line on run ${
        index + 1
      }.\nLast output:\n${tail}`,
    )
  }

  return builtInMs
}

function summarize(times) {
  const sorted = [...times].sort((a, b) => a - b)
  const sum = times.reduce((acc, t) => acc + t, 0)
  const avg = sum / times.length
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  const variance =
    times.reduce((acc, t) => acc + (t - avg) ** 2, 0) / times.length
  const stddev = Math.sqrt(variance)
  return { avg, min, max, median, stddev }
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(2)}s`
}

function buildTable(rows) {
  const widths = rows[0].map((_, col) =>
    Math.max(...rows.map(row => String(row[col]).length)),
  )
  const formatRow = row =>
    `| ${row.map((cell, i) => String(cell).padEnd(widths[i], ' ')).join(' | ')} |`
  const separator = `| ${widths.map(w => '-'.repeat(w)).join(' | ')} |`
  return [formatRow(rows[0]), separator, ...rows.slice(1).map(formatRow)].join(
    '\n',
  )
}

function renderStatsTable(labelA, labelB, statsA, statsB) {
  const diff = statsB.avg - statsA.avg
  const ratio = statsB.avg / statsA.avg
  const sign = diff >= 0 ? '+' : '-'
  const table = buildTable([
    ['metric', labelA, labelB],
    ['avg', formatMs(statsA.avg), formatMs(statsB.avg)],
    ['median', formatMs(statsA.median), formatMs(statsB.median)],
    ['min', formatMs(statsA.min), formatMs(statsB.min)],
    ['max', formatMs(statsA.max), formatMs(statsB.max)],
    ['stddev', formatMs(statsA.stddev), formatMs(statsB.stddev)],
    ['avg diff', '-', `${sign}${formatMs(Math.abs(diff))}`],
    ['avg ratio', '-', `${ratio.toFixed(2)}x`],
  ])
  console.log(table)
}

for (const testCase of cases) {
  console.log(`\n== ${testCase.title} ==`)
  const timesA = []
  const timesB = []

  if (warmup > 0) {
    console.log(`\nWarmup x${warmup} - ${testCase.a.label}`)
    for (let i = 0; i < warmup; i += 1) {
      runOnce(testCase.a.cmd, testCase.a.args, testCase.a.label, i)
    }
    console.log(`\nWarmup x${warmup} - ${testCase.b.label}`)
    for (let i = 0; i < warmup; i += 1) {
      runOnce(testCase.b.cmd, testCase.b.args, testCase.b.label, i)
    }
  }

  for (let i = 0; i < runs; i += 1) {
    console.log(`\nRun ${i + 1}/${runs} - ${testCase.a.label}`)
    const timeA = runOnce(testCase.a.cmd, testCase.a.args, testCase.a.label, i)
    timesA.push(timeA)
    console.log(`time: ${formatMs(timeA)}`)
  }

  for (let i = 0; i < runs; i += 1) {
    console.log(`\nRun ${i + 1}/${runs} - ${testCase.b.label}`)
    const timeB = runOnce(testCase.b.cmd, testCase.b.args, testCase.b.label, i)
    timesB.push(timeB)
    console.log(`time: ${formatMs(timeB)}`)
  }

  const statsA = summarize(timesA)
  const statsB = summarize(timesB)
  console.log('')
  renderStatsTable(testCase.a.label, testCase.b.label, statsA, statsB)
}

console.log('\nDone.')
