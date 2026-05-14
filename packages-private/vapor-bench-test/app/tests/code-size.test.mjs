import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyModule,
  createBundleAttribution,
  createGeneratedCodeSummary,
  createRenderedGeneratedCodeSummary,
} from '../src/bench/codeSize.mjs'

const appRoot = '/repo/packages-private/vapor-bench-test/app'
const repoRoot = '/repo'

test('classifies Vapor runtime and generated component modules', () => {
  assert.equal(
    classifyModule('/repo/packages/runtime-vapor/dist/runtime-vapor.esm.js', {
      appRoot,
      repoRoot,
      scenarioId: 'dashboard',
      targetId: 'vapor',
    }),
    'vapor-runtime',
  )
  assert.equal(
    classifyModule(
      `${appRoot}/src/scenarios/dashboard/vue/Vapor.vue?vue&type=template`,
      {
        appRoot,
        repoRoot,
        scenarioId: 'dashboard',
        targetId: 'vapor',
      },
    ),
    'generated-component',
  )
  assert.equal(
    classifyModule(`${appRoot}/src/scenarios/dashboard/data.mjs`, {
      appRoot,
      repoRoot,
      scenarioId: 'dashboard',
      targetId: 'vapor',
    }),
    'scenario-user-code',
  )
})

test('module classification accepts app roots with trailing slash', () => {
  assert.equal(
    classifyModule(
      `${appRoot}/src/scenarios/dashboard/vue/Vapor.vue?vue&type=template`,
      {
        appRoot: `${appRoot}/`,
        repoRoot,
        scenarioId: 'dashboard',
        targetId: 'vapor',
      },
    ),
    'generated-component',
  )
})

test('solid entry modules are scenario user code, not generated component code', () => {
  assert.equal(
    classifyModule(`${appRoot}/src/scenarios/dashboard/entries/solid.tsx`, {
      appRoot,
      repoRoot,
      scenarioId: 'dashboard',
      targetId: 'solid',
    }),
    'scenario-user-code',
  )
  assert.equal(
    classifyModule(`${appRoot}/src/scenarios/dashboard/solid/Solid.tsx`, {
      appRoot,
      repoRoot,
      scenarioId: 'dashboard',
      targetId: 'solid',
    }),
    'generated-component',
  )
})

test('bundle attribution reports rendered byte shares by module bucket', () => {
  const attribution = createBundleAttribution({
    appRoot,
    repoRoot,
    scenarioId: 'dashboard',
    targetId: 'vapor',
    chunks: [
      {
        type: 'chunk',
        code: 'x'.repeat(1000),
        modules: {
          '/repo/packages/runtime-vapor/dist/runtime-vapor.esm.js': {
            renderedLength: 500,
          },
          [`${appRoot}/src/scenarios/dashboard/vue/Vapor.vue?vue&type=template`]:
            {
              renderedLength: 300,
            },
          [`${appRoot}/src/scenarios/dashboard/data.mjs`]: {
            renderedLength: 200,
          },
        },
      },
    ],
  })

  assert.equal(attribution.totalRenderedBytes, 1000)
  assert.equal(attribution.buckets['vapor-runtime'].renderedBytes, 500)
  assert.equal(attribution.buckets['generated-component'].sharePct, 30)
  assert.equal(attribution.buckets['scenario-user-code'].sharePct, 20)
})

test('generated code summary totals raw, gzip, and brotli sizes', () => {
  const summary = createGeneratedCodeSummary([
    {
      id: `${appRoot}/src/scenarios/dashboard/vue/Vapor.vue`,
      code: 'export default 1',
    },
    {
      id: `${appRoot}/src/scenarios/dashboard/vue/VaporCard.vue`,
      code: 'export default 2',
    },
  ])

  assert.equal(summary.totals.raw, 32)
  assert.equal(summary.modules.length, 2)
  assert.ok(summary.totals.gzip > 0)
  assert.ok(summary.totals.brotli > 0)
})

test('rendered generated code summary reports final rendered module bytes', () => {
  const summary = createRenderedGeneratedCodeSummary({
    appRoot,
    repoRoot,
    scenarioId: 'dashboard',
    targetId: 'vapor',
    chunks: [
      {
        type: 'chunk',
        modules: {
          [`${appRoot}/src/scenarios/dashboard/vue/Vapor.vue?vue&type=template`]:
            {
              renderedLength: 120,
            },
          [`${appRoot}/src/scenarios/dashboard/vue/Vapor.vue?vue&type=script&setup=true&vapor=true&lang.ts`]:
            {
              renderedLength: 280,
            },
          [`${appRoot}/src/scenarios/dashboard/data.mjs`]: {
            renderedLength: 900,
          },
        },
      },
    ],
  })

  assert.equal(summary.totals.renderedBytes, 400)
  assert.equal(summary.modules.length, 2)
  assert.deepEqual(
    summary.modules.map(module => module.renderedBytes),
    [280, 120],
  )
})
