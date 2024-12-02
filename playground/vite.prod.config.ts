import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import * as CompilerSFC from '@vue/compiler-sfc'

export default defineConfig({
  build: {
    target: 'esnext',
    minify: false,
    terserOptions: {
      compress: {
        pure_getters: true,
      },
    },
  },
  clearScreen: false,
  plugins: [
    Vue({
      compiler: CompilerSFC,
    }),
  ],
})
