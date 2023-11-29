import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import { DevPlugin } from './setup/dev'

export default defineConfig({
  build: {
    target: 'esnext'
  },
  clearScreen: false,
  plugins: [DevPlugin(), Inspect()]
})
