import { configDefaults } from 'vitest/config'
import { playwright } from 'vitest/browser-playwright'
import { defineConfig } from 'vite-plus'
import { entries } from './scripts/aliases.js'

export default defineConfig({
  define: {
    __DEV__: process.env.MODE !== 'benchmark',
    __TEST__: true,
    __E2E_TEST__: false,
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
    setupFiles: 'scripts/setup-vitest.ts',
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**'],
      exclude: [
        'packages/vue-compat/**',
        'packages/vue/src/dev.ts',
        'packages/vue/src/runtime.ts',
        'packages/vue/src/runtime-with-vapor.ts',
        'packages/vue/src/index-with-vapor.ts',
        'packages/runtime-core/src/profiling.ts',
        'packages/runtime-core/src/featureFlags.ts',
        'packages/runtime-core/src/customFormatter.ts',
        'packages/runtime-core/src/hydrationStrategies.ts',
        'packages/runtime-dom/src/components/Transition*',
        'packages/runtime-vapor/src/components/Transition*',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit-gc',
          pool: 'forks',
          execArgv: ['--expose-gc'],
          include: ['packages/reactivity/__tests__/gc.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: [
            ...configDefaults.exclude,
            'packages/reactivity/__tests__/gc.spec.ts',
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
          environment: 'jsdom',
          isolate: true,
          include: ['packages/vue/__tests__/e2e/*.spec.ts'],
        },
      },
      {
        extends: './packages-private/vapor-e2e-test/vite.config.ts',
        root: './packages-private/vapor-e2e-test',
        test: {
          globals: true,
          isolate: true,
          name: 'e2e-vapor',
          setupFiles: ['./__tests__/setupBrowser.ts'],
          browser: {
            enabled: true,
            provider: playwright({
              launchOptions: {
                args: process.env.CI
                  ? ['--no-sandbox', '--disable-setuid-sandbox']
                  : [],
              },
            }),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
          include: ['./__tests__/*.spec.ts'],
        },
      },
    ],
    onConsoleLog(log) {
      if (log.startsWith('You are running a development build of Vue.')) {
        return false
      }
    },
  },
  staged: {
    '*.{js,json}': ['vp fmt --no-error-on-unmatched-pattern'],
    '*.ts?(x)': ['vp lint --fix', 'vp fmt --no-error-on-unmatched-pattern'],
  },
  lint: {
    categories: {
      correctness: 'off',
    },
    env: {
      builtin: true,
    },
    ignorePatterns: [
      '**/dist/',
      '**/temp/',
      '**/coverage/',
      'dts-build/packages',
    ],
    overrides: [
      {
        files: ['**/*.js', '**/*.ts', '**/*.tsx'],
        rules: {
          'no-debugger': 'error',
          'no-console': [
            'error',
            {
              allow: ['warn', 'error', 'info'],
            },
          ],
          'no-restricted-globals': [
            'error',
            'window',
            'document',
            'module',
            'require',
          ],
          'sort-imports': [
            'error',
            {
              ignoreDeclarationSort: true,
            },
          ],
          '@typescript-eslint/prefer-ts-expect-error': 'error',
          '@typescript-eslint/consistent-type-imports': [
            'error',
            {
              fixStyle: 'inline-type-imports',
              disallowTypeAnnotations: false,
            },
          ],
          '@typescript-eslint/no-import-type-side-effects': 'error',
        },
      },
      {
        files: ['packages/shared/**'],
        rules: {
          'no-restricted-globals': 'off',
        },
      },
      {
        files: ['packages/{vue,vue-compat,runtime-*}/**'],
        rules: {
          'no-restricted-globals': ['error', 'module', 'require'],
          'oxc/no-optional-chaining': 'error',
        },
      },
      {
        files: ['packages/{compiler-*,server-renderer}/**'],
        rules: {
          'no-restricted-globals': ['error', 'window', 'document'],
          'oxc/no-const-enum': 'error',
        },
      },
      {
        files: [
          'packages-private/template-explorer/**',
          'packages-private/sfc-playground/**',
        ],
        rules: {
          'no-restricted-globals': ['error', 'module', 'require'],
          'oxc/no-const-enum': 'error',
          'no-console': 'off',
        },
      },
      {
        files: ['*.js'],
        rules: {
          'no-unused-vars': [
            'error',
            {
              vars: 'all',
              args: 'none',
            },
          ],
        },
      },
      {
        files: [
          '**/__tests__/**',
          'packages-private/dts-test/**',
          'packages-private/dts-build-test/**',
        ],
        rules: {
          'no-console': 'off',
          'no-restricted-globals': 'off',
          'no-unused-vars': 'off',
          'oxc/no-optional-chaining': 'off',
          'no-restricted-syntax': 'off',
        },
        globals: {
          suite: 'writable',
          test: 'writable',
          describe: 'writable',
          it: 'writable',
          expectTypeOf: 'writable',
          assertType: 'writable',
          expect: 'writable',
          assert: 'writable',
          chai: 'writable',
          vitest: 'writable',
          vi: 'writable',
          beforeAll: 'writable',
          afterAll: 'writable',
          beforeEach: 'writable',
          afterEach: 'writable',
          onTestFailed: 'writable',
          onTestFinished: 'writable',
        },
      },
      {
        files: [
          'scripts/**',
          './*.{js,ts}',
          'packages/*/*.js',
          'packages/vue/*/*.js',
          'packages-private/benchmark/*',
          'packages-private/e2e-utils/*',
        ],
        rules: {
          'no-restricted-globals': 'off',
          'oxc/no-const-enum': 'error',
          'no-console': 'off',
        },
      },
    ],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    arrowParens: 'avoid',
    printWidth: 80,
    experimentalSortPackageJson: false,
    ignorePatterns: ['dist', 'CHANGELOG*.md', '*.toml'],
  },
})
