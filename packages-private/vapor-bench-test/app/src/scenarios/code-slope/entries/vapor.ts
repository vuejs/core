import { createVaporApp } from 'vue'
import { components } from '../generated/vapor-manifest'

performance.mark('bench:entry-start')

;(globalThis as any).__BENCH_CODE_SLOPE_COMPONENTS__ = components

createVaporApp(components[0] as any, { index: 0 }).mount('#app')
