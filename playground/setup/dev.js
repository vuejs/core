// @ts-check
import path from 'node:path'

const resolve = (/** @type {string} */ p) =>
  path.resolve(import.meta.dirname, '../../packages', p)

/**
 * @param {Object} [env]
 * @param {boolean} [env.browser]
 * @returns {import('vite').Plugin}
 */
export function DevPlugin({ browser = false } = {}) {
  return {
    name: 'dev-plugin',
    config() {
      return {
        resolve: {
          alias: {
            'vue/vapor': resolve('vue/vapor/index.mjs'),
            vue: resolve('vue/src/runtime.ts'),
            '@vue/vapor': resolve('vue-vapor/src'),

            '@vue/runtime-core': resolve('runtime-core/src'),
            '@vue/runtime-dom': resolve('runtime-dom/src'),
            '@vue/runtime-vapor': resolve('runtime-vapor/src'),

            '@vue/compiler-core': resolve('compiler-core/src'),
            '@vue/compiler-dom': resolve('compiler-dom/src'),
            '@vue/compiler-vapor': resolve('compiler-vapor/src'),

            '@vue/compiler-sfc': resolve('compiler-sfc/src'),
            '@vue/compiler-ssr': resolve('compiler-ssr/src'),

            '@vue/reactivity': resolve('reactivity/src'),
            '@vue/shared': resolve('shared/src'),
            '@vue/runtime-shared': resolve('runtime-shared/src'),
          },
        },
        define: {
          __COMMIT__: `"__COMMIT__"`,
          __VERSION__: `"0.0.0"`,
          __DEV__: `true`,
          // this is only used during Vue's internal tests
          __TEST__: `false`,
          // If the build is expected to run directly in the browser (global / esm builds)
          __BROWSER__: String(browser),
          __GLOBAL__: String(false),
          __ESM_BUNDLER__: String(true),
          __ESM_BROWSER__: String(false),
          // is targeting Node (SSR)?
          __NODE_JS__: String(false),
          // need SSR-specific branches?
          __SSR__: String(false),
          __BENCHMARK__: 'false',

          // 2.x compat build
          __COMPAT__: String(false),

          // feature flags
          __FEATURE_SUSPENSE__: `true`,
          __FEATURE_OPTIONS_API__: `true`,
          __FEATURE_PROD_DEVTOOLS__: `false`,
        },
      }
    },
  }
}
