import { configDefaults, defineConfig } from 'vitest/config'
import { entries } from './scripts/aliases.js'
import codspeedPlugin from '@codspeed/vitest-plugin'

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
  plugins: [codspeedPlugin()],
  test: {
    globals: true,
    setupFiles: 'scripts/setup-vitest.ts',
    environmentMatchGlobs: [
      ['packages/{vue,vue-compat,runtime-dom}/**', 'jsdom'],
    ],
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      exclude: [
        ...configDefaults.coverage.exclude!,
        // DOM transitions are tested via e2e so no coverage is collected
        'packages/runtime-dom/src/components/Transition*',
        // mostly entries
        'packages/vue-compat/**',
        'packages/sfc-playground/**',
        'scripts/**',
      ],
    },
  },
})
