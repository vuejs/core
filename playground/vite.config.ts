import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import { DevPlugin } from './setup/dev'
import Vue from '@vitejs/plugin-vue'
import * as CompilerSFC from '@vue/compiler-sfc'

export default defineConfig({
  resolve: {
    alias: [{ find: /^vue$/, replacement: 'vue/vapor' }],
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        pure_getters: true,
      },
    },
  },
  clearScreen: false,
  plugins: [
    Vue({
      template: {
        // @ts-expect-error
        vapor: true,
      },
      compiler: CompilerSFC,
    }),
    DevPlugin(),
    Inspect(),
  ],
  optimizeDeps: {
    exclude: ['@vueuse/core'],
  },
})
