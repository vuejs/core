import path from 'node:path'
import { type Plugin, defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import * as CompilerVapor from '../packages/compiler-vapor/src'

export default defineConfig({
  build: {
    target: 'esnext'
  },
  clearScreen: false,
  plugins: [
    DevPlugin(),
    Vue({
      isProduction: true,
      template: {
        compiler: CompilerVapor
      }
    }),
    Inspect()
  ]
})

function DevPlugin(): Plugin {
  const resolve = (p: string) => path.resolve(__dirname, '..', p)
  return {
    name: 'dev-plugin',
    config() {
      return {
        resolve: {
          alias: {
            'vue/vapor': resolve('packages/vue/vapor/index.mjs'),
            vue: resolve('packages/vue/src/runtime.ts'),
            '@vue/vapor': resolve('packages/vue-vapor/src/index.ts'),
            '@vue/runtime-dom': resolve('packages/runtime-dom/src/index.ts'),
            '@vue/runtime-core': resolve('packages/runtime-core/src/index.ts'),
            '@vue/shared': resolve('packages/shared/src/index.ts'),
            '@vue/reactivity': resolve('packages/reactivity/src/index.ts'),
            '@vue/compiler-vapor': resolve(
              'packages/compiler-vapor/src/index.ts'
            ),
            '@vue/runtime-vapor': resolve('packages/runtime-vapor/src/index.ts')
          }
        },
        define: {
          __COMMIT__: `"__COMMIT__"`,
          __VERSION__: `"0.0.0"`,
          __DEV__: `true`,
          // this is only used during Vue's internal tests
          __TEST__: `false`,
          // If the build is expected to run directly in the browser (global / esm builds)
          __BROWSER__: String(true),
          __GLOBAL__: String(false),
          __ESM_BUNDLER__: String(true),
          __ESM_BROWSER__: String(false),
          // is targeting Node (SSR)?
          __NODE_JS__: String(false),
          // need SSR-specific branches?
          __SSR__: String(false),

          // 2.x compat build
          __COMPAT__: String(false),

          // feature flags
          __FEATURE_SUSPENSE__: `true`,
          __FEATURE_OPTIONS_API__: `true`,
          __FEATURE_PROD_DEVTOOLS__: `false`
        }
      }
    }
  }
}
