import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Inspect from 'vite-plugin-inspect'
// @ts-ignore
import * as CompilerVapor from '../packages/compiler-vapor/dist/compiler-vapor.esm-bundler.prod.js'

const vue = Vue({
  isProduction: true,
  template: {
    compiler: CompilerVapor
  }
})

export default defineConfig({
  build: {
    target: 'esnext'
  },
  clearScreen: false,
  plugins: [vue, Inspect()]
})
