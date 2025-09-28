import { bench, describe } from 'vitest'
import {
  effectScope,
  onEffectCleanup,
} from '../dist/reactivity.esm-browser.prod'

describe('effectScope', () => {
  function benchEffectCreateAndStop(size: number) {
    bench(
      `create and stop an effectScope that tracks ${size} cleanup functions`,
      () => {
        const scope = effectScope()
        scope.run(() => {
          for (let i = 0; i < size; i++) {
            onEffectCleanup(() => {})
          }
        })
        scope.stop()
      },
    )
  }

  benchEffectCreateAndStop(10)
  benchEffectCreateAndStop(100)
  benchEffectCreateAndStop(1000)
})
