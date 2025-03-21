import { configDefaults, defineProject, mergeConfig } from 'vitest/config'
import config from './vitest.config'

export default mergeConfig(
  config,
  defineProject({
    test: {
      name: 'unit',
      exclude: [...configDefaults.exclude, '**/e2e/**'],
    },
  }),
)
