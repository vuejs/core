import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import {
  getLatestReportPath,
  getRunResultPath,
  resolveReportRunId,
} from '../src/bench/output.mjs'
import { createCodeSlopeSummary } from '../src/bench/codeSlope.mjs'
import { renderCodeSlopeReport } from '../src/bench/codeSlopeReport.mjs'

const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const generatedRoot = path.join(
  appRoot,
  'src',
  'scenarios',
  'code-slope',
  'generated',
)
const distRoot = path.join(appRoot, 'dist', 'code-slope')
const artifactRoot = path.join(appRoot, '.bench-artifacts', 'code-slope')
const targets = ['vdom', 'vapor', 'solid']
const counts = parseCounts(
  process.env.BENCH_CODE_SLOPE_COUNTS || '1,10,100,500',
)
const runs = Number(process.env.BENCH_SLOPE_RUNS || 3)
const reportRunId = resolveReportRunId(process.env)
const runId = `code-slope-${new Date().toISOString().replace(/[:.]/g, '-')}`
const resultDir = getRunResultPath(appRoot, runId)
const samples = []

if (!Number.isInteger(runs) || runs <= 0) {
  throw new Error(`BENCH_SLOPE_RUNS must be a positive integer, got ${runs}`)
}

await fs.mkdir(resultDir, { recursive: true })

for (let run = 1; run <= runs; run++) {
  for (const count of counts) {
    await writeGeneratedComponents(count)

    for (const target of targets) {
      console.info(
        `\n[code-slope] run ${run}/${runs}, ${count} component(s), ${target}`,
      )
      await buildTarget(target, count)

      const bundleSize = await collectBundleSize(target, count)
      samples.push({
        run,
        count,
        target,
        bundleSize,
      })
    }
  }
}

const summary = createCodeSlopeSummary(samples)
const report = renderCodeSlopeReport({
  summary,
  runId,
  runs,
})
const reportPath = getLatestReportPath(appRoot, 'code-slope', reportRunId)

await fs.writeFile(
  path.join(resultDir, 'code-slope-samples.json'),
  `${JSON.stringify(samples, null, 2)}\n`,
)
await fs.writeFile(
  path.join(resultDir, 'code-slope-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
)
await fs.mkdir(path.dirname(reportPath), { recursive: true })
await fs.writeFile(reportPath, report)

console.table(
  Object.fromEntries(
    Object.entries(summary.targets).map(([target, targetSummary]) => [
      target,
      {
        generatedGzipPerComponent:
          targetSummary.slope.generatedGzipPerComponent,
        generatedRenderedBytesPerComponent:
          targetSummary.slope.generatedRenderedBytesPerComponent,
        bundleGzipPerComponent: targetSummary.slope.bundleGzipPerComponent,
        runtimeRenderedBytesAtMax:
          targetSummary.slope.runtimeRenderedBytesAtMax,
      },
    ]),
  ),
)
console.info(`Results written to ${path.relative(appRoot, resultDir)}`)
console.info(`Report written to ${path.relative(appRoot, reportPath)}`)

async function buildTarget(target, count) {
  await runCommand('pnpm', ['exec', 'vite', 'build'], {
    ...process.env,
    BENCH_SCENARIO: 'code-slope',
    BENCH_TARGET: target,
    BENCH_CODE_SLOPE_COUNT: String(count),
  })
}

async function collectBundleSize(target, count) {
  const dir = path.join(distRoot, String(count), target)
  const files = await listFiles(dir)
  const assetFiles = files.filter(file => /\.js$/.test(file))
  const totals = { raw: 0, gzip: 0, brotli: 0 }
  const assets = []

  for (const file of assetFiles) {
    const bytes = await fs.readFile(file)
    const asset = {
      file: path.relative(dir, file),
      raw: bytes.length,
      gzip: gzipSync(bytes).length,
      brotli: brotliCompressSync(bytes).length,
    }
    totals.raw += asset.raw
    totals.gzip += asset.gzip
    totals.brotli += asset.brotli
    assets.push(asset)
  }

  const artifact = JSON.parse(
    await fs.readFile(path.join(artifactRoot, `${target}.json`), 'utf8'),
  )

  return {
    count,
    totals,
    assets,
    ...artifact,
  }
}

async function writeGeneratedComponents(count) {
  const vdomDir = path.join(generatedRoot, 'vdom')
  const vaporDir = path.join(generatedRoot, 'vapor')
  const solidDir = path.join(generatedRoot, 'solid')
  const vdomNames = []
  const vaporNames = []
  const solidNames = []

  await fs.rm(generatedRoot, { recursive: true, force: true })
  await fs.mkdir(vdomDir, { recursive: true })
  await fs.mkdir(vaporDir, { recursive: true })
  await fs.mkdir(solidDir, { recursive: true })

  for (let index = 0; index < count; index++) {
    const name = `SlopeCard${String(index).padStart(3, '0')}`
    vdomNames.push(name)
    vaporNames.push(name)
    solidNames.push(name)

    await fs.writeFile(
      path.join(vdomDir, `${name}.vue`),
      createVueComponent({
        name,
        index,
        target: 'vdom',
        vapor: false,
      }),
    )
    await fs.writeFile(
      path.join(vaporDir, `${name}.vue`),
      createVueComponent({
        name,
        index,
        target: 'vapor',
        vapor: true,
      }),
    )
    await fs.writeFile(
      path.join(solidDir, `${name}.tsx`),
      createSolidComponent({ name, index }),
    )
  }

  await fs.writeFile(
    path.join(generatedRoot, 'vdom-manifest.ts'),
    createManifest({ names: vdomNames, target: 'vdom', extension: '.vue' }),
  )
  await fs.writeFile(
    path.join(generatedRoot, 'vapor-manifest.ts'),
    createManifest({ names: vaporNames, target: 'vapor', extension: '.vue' }),
  )
  await fs.writeFile(
    path.join(generatedRoot, 'solid-manifest.ts'),
    createManifest({ names: solidNames, target: 'solid', extension: '' }),
  )
}

function createVueComponent({ name, index, target, vapor }) {
  const vaporAttribute = vapor ? ' vapor' : ''

  return `<script setup${vaporAttribute} lang="ts">
const props = defineProps<{ index: number }>()
const emit = defineEmits<{ select: [index: number] }>()
const rows = [0, 1, 2, 3]
const label = '${name}'
const offset = ${index}
const status = offset % 2 === 0 ? 'active' : 'idle'
</script>

<template>
  <section
    class="slope-card"
    :class="{ active: status === 'active' }"
    data-target="${target}"
    :data-index="props.index"
  >
    <header>
      <h2>{{ label }}</h2>
      <span>{{ status }}</span>
    </header>
    <ul>
      <li
        v-for="row in rows"
        :key="row"
        :class="{ hot: row === props.index % 4 }"
        :data-row="row"
      >
        <strong>{{ props.index }}-{{ row }}</strong>
        <em>{{ props.index + row + offset }}</em>
      </li>
    </ul>
    <button @click="emit('select', props.index)">Select {{ label }}</button>
  </section>
</template>
`
}

function createSolidComponent({ name, index }) {
  return `import { For } from 'solid-js'

export default function ${name}(props: { index: number }) {
  const rows = [0, 1, 2, 3]
  const label = '${name}'
  const offset = ${index}
  const status = () => (offset % 2 === 0 ? 'active' : 'idle')

  return (
    <section
      class="slope-card"
      classList={{ active: status() === 'active' }}
      data-target="solid"
      data-index={props.index}
    >
      <header>
        <h2>{label}</h2>
        <span>{status()}</span>
      </header>
      <ul>
        <For each={rows}>
          {row => (
            <li
              classList={{ hot: row === props.index % 4 }}
              data-row={row}
            >
              <strong>{props.index}-{row}</strong>
              <em>{props.index + row + offset}</em>
            </li>
          )}
        </For>
      </ul>
      <button
        onClick={() =>
          ((globalThis as any).__BENCH_CODE_SLOPE_LAST__ = props.index)
        }
      >
        Select {label}
      </button>
    </section>
  )
}
`
}

function createManifest({ names, target, extension }) {
  const imports = names
    .map(name => `import ${name} from './${target}/${name}${extension}'`)
    .join('\n')
  const exports = names.join(', ')

  return `${imports}

export const components = [${exports}]
`
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      stdio: 'inherit',
      env,
    })

    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(
          new Error(`${command} ${args.join(' ')} exited with code ${code}`),
        )
      }
    })
  })
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)))
    } else {
      files.push(fullPath)
    }
  }

  return files
}

function parseCounts(value) {
  const counts = value.split(',').map(part => Number(part.trim()))

  for (const count of counts) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(
        `BENCH_CODE_SLOPE_COUNTS must be comma-separated positive integers, got "${value}"`,
      )
    }
  }

  return [...new Set(counts)].sort((a, b) => a - b)
}
