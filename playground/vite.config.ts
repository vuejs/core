import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import { DevPlugin } from './setup/dev'
import Vue from '@vitejs/plugin-vue'
import * as CompilerVapor from '@vue/compiler-vapor'
import * as CompilerSFC from '@vue/compiler-sfc'

export default defineConfig({
  build: {
    target: 'esnext',
  },
  clearScreen: false,
  plugins: [
    Vue({
      template: {
        compiler: CompilerVapor as any,
      },
      compiler: CompilerSFC,
    }),
    DevPlugin(),
    Inspect(),
  ],
})
