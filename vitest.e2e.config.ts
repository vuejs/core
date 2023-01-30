import { UserConfig } from 'vitest/config'
import config from './vitest.config'

export default {
  ...config,
  test: {
    ...config.test,
    include: ['packages/vue/__tests__/e2e/*.spec.ts']
  }
} as UserConfig
