import { configDefaults, defineConfig, UserConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'

const resolve = p =>
  path.resolve(fileURLToPath(import.meta.url), `../packages/${p}/src/index.ts`)
const dirs = readdirSync(new URL('./packages', import.meta.url))

const alias = {
  vue: resolve('vue'),
  'vue/compiler-sfc': resolve('compiler-sfc'),
  'vue/server-renderer': resolve('server-renderer'),
  '@vue/compat': resolve('vue-compat')
}

for (const dir of dirs) {
  const key = `@vue/${dir}`
  if (dir !== 'vue' && !(key in alias)) {
    alias[key] = resolve(dir)
  }
}

export default defineConfig({
  define: {
    __DEV__: true,
    __TEST__: true,
    __VERSION__: '"test"',
    __BROWSER__: false,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __NODE_JS__: true,
    __SSR__: true,
    __FEATURE_OPTIONS_API__: true,
    __FEATURE_SUSPENSE__: true,
    __FEATURE_PROD_DEVTOOLS__: false,
    __COMPAT__: true
  },
  resolve: {
    alias
  },
  test: {
    globals: true,
    setupFiles: 'scripts/setupVitest.ts',
    environmentMatchGlobs: [
      ['packages/{vue,vue-compat,runtime-dom}/**', 'jsdom']
    ],
    sequence: {
      hooks: 'list'
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      exclude: [
        ...configDefaults.coverage.exclude!,
        // DOM transitions are tested via e2e so no coverage is collected
        'packages/runtime-dom/src/components/Transition*',
        // mostly entries
        'packages/vue-compat/**'
      ]
    }
  }
}) as UserConfig
