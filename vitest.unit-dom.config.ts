import { configDefaults, mergeConfig } from 'vitest/config'
import config from './vitest.config'

export default mergeConfig(config, {
  test: {
    name: 'unit-dom',
    include: ['packages/{vue,vue-compat,runtime-dom}/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, '**/e2e/**'],
    environment: 'jsdom',
  },
})
