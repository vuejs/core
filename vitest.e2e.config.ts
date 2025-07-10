import { mergeConfig } from 'vitest/config'
import config from './vitest.config'

export default mergeConfig(config, {
  test: {
    name: 'e2e',
    poolOptions: {
      threads: {
        singleThread: !!process.env.CI,
      },
    },
    include: ['packages/vue/__tests__/e2e/*.spec.ts'],
  },
})
