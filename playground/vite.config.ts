import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
import * as CompilerVapor from '../packages/compiler-vapor/src'

export default defineConfig({
  plugins: [
    Vue({
      template: {
        compiler: CompilerVapor
      }
    }),
    Inspect()
  ]
})
