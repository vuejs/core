import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'

const resolve = p =>
  path.resolve(fileURLToPath(import.meta.url), `../packages/${p}/src`)
const dirs = readdirSync(new URL('./packages', import.meta.url))
const alias = {}
for (const dir of dirs) {
  alias[`@vue/${dir}`] = resolve(dir)
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
    alias: {
      ...alias,
      vue: resolve('vue'),
      'vue/compiler-sfc': resolve('compiler-sfc'),
      'vue/server-renderer': resolve('server-renderer'),
      '@vue/compat': resolve('vue-compat')
    }
  },
  test: {
    globals: true,
    setupFiles: 'scripts/setupVitest.ts'
  }
})
