import { configDefaults, defineConfig } from 'vitest/config'
import { entries } from './scripts/aliases.js'

export default defineConfig({
  define: {
    __DEV__: process.env.MODE !== 'benchmark',
    __TEST__: true,
    __VERSION__: '"test"',
    __BROWSER__: false,
    __GLOBAL__: false,
    __ESM_BUNDLER__: true,
    __ESM_BROWSER__: false,
    __CJS__: true,
    __SSR__: true,
    __BENCHMARK__: false,
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
    poolOptions: {
      forks: {
        execArgv: ['--expose-gc'],
      },
    },
    setupFiles: 'scripts/setup-vitest.ts',
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
    workspace: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: [
            ...configDefaults.exclude,
            '**/e2e/**',
            '**/vapor-e2e-test/**',
            'packages/{vue,vue-compat,runtime-dom,runtime-vapor}/**',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-jsdom',
          environment: 'jsdom',
          include: [
            'packages/{vue,vue-compat,runtime-dom,runtime-vapor}/**/*.spec.ts',
          ],
          exclude: [...configDefaults.exclude, '**/e2e/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          poolOptions: {
            threads: {
              singleThread: !!process.env.CI,
            },
          },
          include: ['packages/vue/__tests__/e2e/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e-vapor',
          poolOptions: {
            threads: {
              singleThread: !!process.env.CI,
            },
          },
          include: ['packages-private/vapor-e2e-test/__tests__/*.spec.ts'],
        },
      },
    ],
  },
})
