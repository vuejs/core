import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import vue from '@vitejs/plugin-vue'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vite'
import { resolveScenario } from './src/bench/targets.mjs'

const require = createRequire(import.meta.url)
const rootDir = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = path.resolve(rootDir, '../../..')
const compiler = require('../../../packages/compiler-sfc/dist/compiler-sfc.cjs.js')
const vueRuntime = path.resolve(
  repoRoot,
  'packages/vue/dist/vue.runtime.esm-bundler.js',
)
const serverRendererRuntime = path.resolve(
  repoRoot,
  'packages/server-renderer/dist/server-renderer.esm-bundler.js',
)
const vueAliases = [
  {
    find: 'vue/server-renderer',
    replacement: serverRendererRuntime,
  },
  {
    find: 'vue',
    replacement: vueRuntime,
  },
  {
    find: '@vue/reactivity',
    replacement: path.resolve(
      repoRoot,
      'packages/reactivity/dist/reactivity.esm-bundler.js',
    ),
  },
  {
    find: '@vue/runtime-core',
    replacement: path.resolve(
      repoRoot,
      'packages/runtime-core/dist/runtime-core.esm-bundler.js',
    ),
  },
  {
    find: '@vue/runtime-dom',
    replacement: path.resolve(
      repoRoot,
      'packages/runtime-dom/dist/runtime-dom.esm-bundler.js',
    ),
  },
  {
    find: '@vue/runtime-vapor',
    replacement: path.resolve(
      repoRoot,
      'packages/runtime-vapor/dist/runtime-vapor.esm-bundler.js',
    ),
  },
  {
    find: '@vue/server-renderer',
    replacement: serverRendererRuntime,
  },
  {
    find: '@vue/shared',
    replacement: path.resolve(
      repoRoot,
      'packages/shared/dist/shared.esm-bundler.js',
    ),
  },
]
const validTargets = new Set(['vdom', 'vapor', 'solid'])
const validBuildModes = new Set(['client', 'server'])

export default defineConfig(({ mode }) => {
  const target = process.env.BENCH_TARGET || mode
  const scenario = process.env.BENCH_SCENARIO || 'dashboard'
  const buildMode = process.env.BENCH_BUILD_MODE || 'client'
  const minify = process.env.BENCH_MINIFY !== 'false'
  const scenarioConfig = resolveScenario(scenario)
  const sourceScenario = scenarioConfig.sourceScenarioId || scenario
  const isHydration = scenarioConfig.measurement === 'hydration-first-screen'
  const isServerBuild = buildMode === 'server'

  if (!validTargets.has(target)) {
    throw new Error(
      `Unknown BENCH_TARGET "${target}". Expected vdom, vapor, or solid.`,
    )
  }
  if (!validBuildModes.has(buildMode)) {
    throw new Error(
      `Unknown BENCH_BUILD_MODE "${buildMode}". Expected client or server.`,
    )
  }
  if (isServerBuild && !isHydration) {
    throw new Error(`BENCH_BUILD_MODE=server is only supported for hydration`)
  }

  const entry = getScenarioEntry(sourceScenario, target, {
    hydration: isHydration,
    server: isServerBuild,
  })

  return {
    root: rootDir,
    base: scenario === 'dashboard' ? `/${target}/` : `/${scenario}/${target}/`,
    clearScreen: false,
    resolve: {
      alias: target === 'solid' ? {} : vueAliases,
    },
    plugins: [
      target === 'solid'
        ? solid({
            ssr: isServerBuild,
            solid: {
              hydratable: isHydration,
            },
          })
        : vue({
            compiler,
          }),
      !isServerBuild && scenarioEntryPlugin(entry),
    ],
    build: {
      outDir: isHydration
        ? path.resolve(rootDir, 'dist', scenario, target, buildMode)
        : scenario === 'dashboard'
          ? path.resolve(rootDir, 'dist', target)
          : path.resolve(rootDir, 'dist', scenario, target),
      emptyOutDir: true,
      ssr: isServerBuild ? path.resolve(rootDir, 'src', entry) : false,
      minify,
      cssMinify: minify,
      sourcemap: false,
      rolldownOptions: {
        output: {
          ...(isServerBuild ? { entryFileNames: 'server.mjs' } : {}),
          topLevelVar: false,
        },
        onwarn(log, handler) {
          if (log.code === 'INVALID_ANNOTATION') return
          handler(log)
        },
      },
    },
    ssr: {
      noExternal: true,
    },
  }
})

function getScenarioEntry(scenario, target, { hydration, server }) {
  const suffix = server ? 'ssr' : hydration ? 'hydration' : ''
  const targetName = suffix ? `${target}-${suffix}` : target
  const entryFile =
    target === 'solid' ? `${targetName}.tsx` : `${targetName}.ts`

  return `scenarios/${scenario}/entries/${entryFile}`
}

function scenarioEntryPlugin(entry) {
  return {
    name: 'scenario-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('%BENCH_ENTRY%', entry)
      },
    },
  }
}
