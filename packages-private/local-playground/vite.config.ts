import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import { DevPlugin } from './setup/dev'
import Vue from '@vitejs/plugin-vue'
import * as CompilerSFC from '@vue/compiler-sfc'

export default defineConfig({
  clearScreen: false,
  plugins: [
    Vue({
      compiler: CompilerSFC,
    }),
    DevPlugin(),
    Inspect(),
  ],
  optimizeDeps: {
    exclude: ['@vueuse/core'],
  },
})
