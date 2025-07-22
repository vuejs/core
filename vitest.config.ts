import { defineConfig } from 'vitest/config'
import { entries } from './scripts/aliases.js'

export default defineConfig({
  define: {
    __DEV__: true,
    __TEST__: true,
    __VERSION__: '"test"',
    __BROWSER__: false,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __CJS__: true,
    __SSR__: true,
    __FEATURE_OPTIONS_API__: true,
    __FEATURE_SUSPENSE__: true,
    __FEATURE_PROD_DEVTOOLS__: false,
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    __COMPAT__: true,
  },
  resolve: {
    alias: entries,
  },
  test: {
    globals: true,
    pool: 'threads',
    setupFiles: 'scripts/setup-vitest.ts',
    environmentMatchGlobs: [
      ['packages/{vue,vue-compat,runtime-dom}/**', 'jsdom'],
    ],
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**'],
      exclude: [
        // entries that are not really used during tests
        'packages/vue-compat/**',
        'packages/vue/src/dev.ts',
        'packages/vue/src/runtime.ts',
        // not testable during unit tests
        'packages/runtime-core/src/profiling.ts',
        'packages/runtime-core/src/featureFlags.ts',
        'packages/runtime-core/src/customFormatter.ts',
        // tested via e2e so no coverage is collected
        'packages/runtime-core/src/hydrationStrategies.ts',
        'packages/runtime-dom/src/components/Transition*',
      ],
    },
  },
})
