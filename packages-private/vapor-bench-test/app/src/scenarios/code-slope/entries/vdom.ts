import { createApp } from 'vue'
import { components } from '../generated/vdom-manifest'

performance.mark('bench:entry-start')

;(globalThis as any).__BENCH_CODE_SLOPE_COMPONENTS__ = components

createApp(components[0], { index: 0 }).mount('#app')
