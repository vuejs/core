import { render } from 'solid-js/web'
import { components } from '../generated/solid-manifest'

performance.mark('bench:entry-start')

;(globalThis as any).__BENCH_CODE_SLOPE_COMPONENTS__ = components

const Component = components[0]

render(
  () => Component({ index: 0 }),
  globalThis.document.getElementById('app')!,
)
