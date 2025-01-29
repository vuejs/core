import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  './vitest.unit-node.config.ts',
  './vitest.unit-dom.config.ts',
  './vitest.e2e.config.ts',
])
