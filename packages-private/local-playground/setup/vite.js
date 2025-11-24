// @ts-check

import { startVite } from 'vite-hyper-config'
import { DevPlugin } from './dev.js'

startVite(
  undefined,
  { plugins: [DevPlugin()] },
  {
    deps: {
      inline: ['@vitejs/plugin-vue'],
    },
  },
)
