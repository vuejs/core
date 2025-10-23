import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import * as CompilerSFC from 'vue/compiler-sfc'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    Vue({
      compiler: CompilerSFC,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        interop: resolve(import.meta.dirname, 'interop/index.html'),
        todomvc: resolve(import.meta.dirname, 'todomvc/index.html'),
        transition: resolve(import.meta.dirname, 'transition/index.html'),
        transitionGroup: resolve(
          import.meta.dirname,
          'transition-group/index.html',
        ),
      },
    },
  },
})
