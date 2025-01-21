import { configDefaults, mergeConfig } from 'vitest/config'
import config from './vitest.config'

export default mergeConfig(config, {
  test: {
    name: 'unit-node',
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
      'packages/{vue,vue-compat,runtime-dom}/**/*.spec.ts',
    ],
  },
})
