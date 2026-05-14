import fs from 'node:fs/promises'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const BUCKETS = [
  'vapor-runtime',
  'vue-runtime',
  'solid-runtime',
  'generated-component',
  'scenario-user-code',
  'third-party',
  'other',
]

export function createCodeSizePlugin(options) {
  const generatedModules = new Map()

  return {
    name: 'bench-code-size',
    enforce: 'post',
    transform(code, id) {
      if (isGeneratedComponentModule(id, options)) {
        const moduleId = normalizeModuleId(id)
        generatedModules.set(moduleId, {
          id: moduleId,
          code,
        })
      }
      return null
    },
    async writeBundle(_outputOptions, bundle) {
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk')
      const artifact = {
        target: options.targetId,
        scenario: options.scenarioId,
        attribution: createBundleAttribution({
          ...options,
          chunks,
        }),
        generatedCode: createGeneratedCodeSummary(
          Array.from(generatedModules.values()),
        ),
        generatedRenderedCode: createRenderedGeneratedCodeSummary({
          ...options,
          chunks,
        }),
      }
      const artifactDir = path.join(
        options.appRoot,
        '.bench-artifacts',
        options.scenarioId,
      )

      await fs.mkdir(artifactDir, { recursive: true })
      await fs.writeFile(
        path.join(artifactDir, `${options.targetId}.json`),
        `${JSON.stringify(artifact, null, 2)}\n`,
      )
    },
  }
}

export function createBundleAttribution({
  appRoot,
  repoRoot,
  scenarioId,
  sourceScenarioId,
  targetId,
  chunks,
}) {
  const buckets = createEmptyBuckets()

  for (const chunk of chunks) {
    for (const [id, info] of Object.entries(chunk.modules || {})) {
      const renderedBytes =
        typeof info.renderedLength === 'number' ? info.renderedLength : 0

      if (renderedBytes === 0) continue

      const bucket = classifyModule(id, {
        appRoot,
        repoRoot,
        scenarioId,
        sourceScenarioId,
        targetId,
      })
      buckets[bucket].renderedBytes += renderedBytes
      buckets[bucket].modules += 1
    }
  }

  const totalRenderedBytes = Object.values(buckets).reduce(
    (total, bucket) => total + bucket.renderedBytes,
    0,
  )

  for (const bucket of Object.values(buckets)) {
    bucket.sharePct =
      totalRenderedBytes === 0
        ? 0
        : round((bucket.renderedBytes / totalRenderedBytes) * 100)
  }

  return {
    totalRenderedBytes,
    buckets,
  }
}

export function createGeneratedCodeSummary(records) {
  const modules = records
    .map(record => {
      const bytes = Buffer.from(record.code)
      return {
        id: record.id,
        raw: bytes.length,
        gzip: gzipSync(bytes).length,
        brotli: brotliCompressSync(bytes).length,
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
  const totals = modules.reduce(
    (current, module) => ({
      raw: current.raw + module.raw,
      gzip: current.gzip + module.gzip,
      brotli: current.brotli + module.brotli,
    }),
    {
      raw: 0,
      gzip: 0,
      brotli: 0,
    },
  )

  return {
    totals,
    modules,
  }
}

export function createRenderedGeneratedCodeSummary({
  appRoot,
  repoRoot,
  scenarioId,
  sourceScenarioId,
  targetId,
  chunks,
}) {
  const modules = []

  for (const chunk of chunks) {
    for (const [id, info] of Object.entries(chunk.modules || {})) {
      const renderedBytes =
        typeof info.renderedLength === 'number' ? info.renderedLength : 0

      if (renderedBytes === 0) continue

      const bucket = classifyModule(id, {
        appRoot,
        repoRoot,
        scenarioId,
        sourceScenarioId,
        targetId,
      })

      if (bucket !== 'generated-component') continue

      modules.push({
        id: normalizeModuleId(id),
        renderedBytes,
      })
    }
  }

  modules.sort((a, b) => {
    if (a.renderedBytes !== b.renderedBytes) {
      return b.renderedBytes - a.renderedBytes
    }

    return a.id.localeCompare(b.id)
  })

  const totals = modules.reduce(
    (current, module) => ({
      renderedBytes: current.renderedBytes + module.renderedBytes,
    }),
    {
      renderedBytes: 0,
    },
  )

  return {
    totals,
    modules,
  }
}

export function classifyModule(id, options) {
  const cleanId = cleanModuleId(id)
  const normalizedAppRoot = normalizeRoot(options.appRoot)
  const normalizedRepoRoot = normalizeRoot(options.repoRoot)
  const sourceScenarioId = options.sourceScenarioId || options.scenarioId
  const scenarioRoot = `${normalizedAppRoot}/src/scenarios/${sourceScenarioId}/`

  if (cleanId.includes('/packages/runtime-vapor/')) {
    return 'vapor-runtime'
  }
  if (
    cleanId.includes('/packages/vue/') ||
    cleanId.includes('/packages/runtime-core/') ||
    cleanId.includes('/packages/runtime-dom/') ||
    cleanId.includes('/packages/reactivity/') ||
    cleanId.includes('/packages/shared/')
  ) {
    return 'vue-runtime'
  }
  if (cleanId.includes('/node_modules/solid-js/')) {
    return 'solid-runtime'
  }
  if (cleanId.startsWith(scenarioRoot)) {
    return isGeneratedComponentModule(cleanId, options)
      ? 'generated-component'
      : 'scenario-user-code'
  }
  if (cleanId.includes('/node_modules/')) {
    return 'third-party'
  }
  if (cleanId.startsWith(normalizedRepoRoot)) {
    return 'other'
  }

  return 'other'
}

function isGeneratedComponentModule(id, options) {
  const cleanId = cleanModuleId(id)
  const sourceScenarioId = options.sourceScenarioId || options.scenarioId
  const scenarioRoot = `${normalizeRoot(options.appRoot)}/src/scenarios/${sourceScenarioId}/`

  if (!cleanId.startsWith(scenarioRoot)) return false

  if (options.targetId === 'solid') {
    return cleanId.endsWith('.tsx') && !cleanId.includes('/entries/')
  }

  return cleanId.includes('.vue')
}

function cleanModuleId(id) {
  return normalizePath(id.replace(/^\0+/, '').split('?')[0])
}

function normalizeModuleId(id) {
  return normalizePath(id.replace(/^\0+/, ''))
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

function normalizeRoot(value) {
  return normalizePath(value).replace(/\/+$/, '')
}

function createEmptyBuckets() {
  return Object.fromEntries(
    BUCKETS.map(bucket => [
      bucket,
      {
        renderedBytes: 0,
        sharePct: 0,
        modules: 0,
      },
    ]),
  )
}

function round(value) {
  return Math.round(value * 10) / 10
}
