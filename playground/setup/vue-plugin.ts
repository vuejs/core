import * as CompilerVapor from '@vue/compiler-vapor'
import * as CompilerSFC from '@vue/compiler-sfc'
import Vue from '@vitejs/plugin-vue'

export const VuePlugin = Vue({
  template: {
    compiler: CompilerVapor
  },
  compiler: CompilerSFC
})
