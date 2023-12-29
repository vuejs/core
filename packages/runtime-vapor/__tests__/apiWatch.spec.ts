import { EffectScope, type Ref, ref } from '@vue/reactivity'
import {
  onEffectCleanup,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from '../src/apiWatch'
import { nextTick } from '../src/scheduler'
import { defineComponent } from 'vue'
import { render } from '../src/render'
import { template } from '../src/template'

let host: HTMLElement

const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => {
  initHost()
})
afterEach(() => {
  host.remove()
})

describe('watchEffect and onEffectCleanup', () => {
  test('basic', async () => {
    let dummy = 0
    let source: Ref<number>
    const scope = new EffectScope()

    scope.run(() => {
      source = ref(0)
      watchEffect((onCleanup) => {
        source.value

        onCleanup(() => (dummy += 2))
        onEffectCleanup(() => (dummy += 3))
        onEffectCleanup(() => (dummy += 5))
      })
    })
    await nextTick()
    expect(dummy).toBe(0)

    scope.run(() => {
      source.value++
    })
    await nextTick()
    expect(dummy).toBe(10)

    scope.run(() => {
      source.value++
    })
    await nextTick()
    expect(dummy).toBe(20)

    scope.stop()
    await nextTick()
    expect(dummy).toBe(30)
  })

  test('nested call to watchEffect', async () => {
    let dummy = 0
    let source: Ref<number>
    let double: Ref<number>
    const scope = new EffectScope()

    scope.run(() => {
      source = ref(0)
      double = ref(0)
      watchEffect(() => {
        double.value = source.value * 2
        onEffectCleanup(() => (dummy += 2))
      })
      watchSyncEffect(() => {
        double.value
        onEffectCleanup(() => (dummy += 3))
      })
    })
    await nextTick()
    expect(dummy).toBe(0)

    scope.run(() => source.value++)
    await nextTick()
    expect(dummy).toBe(5)

    scope.run(() => source.value++)
    await nextTick()
    expect(dummy).toBe(10)

    scope.stop()
    await nextTick()
    expect(dummy).toBe(15)
  })

  test('scheduling order', async () => {
    const calls: string[] = []

    const demo = defineComponent({
      setup() {
        const source = ref(0)
        const change = () => source.value++

        watchPostEffect(() => {
          const current = source.value
          calls.push(`post ${current}`)
          onEffectCleanup(() => calls.push(`post cleanup ${current}`))
        })
        watchEffect(() => {
          const current = source.value
          calls.push(`pre ${current}`)
          onEffectCleanup(() => calls.push(`pre cleanup ${current}`))
        })
        watchSyncEffect(() => {
          const current = source.value
          calls.push(`sync ${current}`)
          onEffectCleanup(() => calls.push(`sync cleanup ${current}`))
        })
        const __returned__ = { source, change }
        Object.defineProperty(__returned__, '__isScriptSetup', {
          enumerable: false,
          value: true,
        })
        return __returned__
      },
    })

    demo.render = (_ctx: any) => {
      const t0 = template('<div></div>')
      watchEffect(() => {
        const current = _ctx.source
        calls.push(`render ${current}`)
        onEffectCleanup(() => calls.push(`render cleanup ${current}`))
      })
      return t0()
    }

    const instance = render(demo as any, {}, '#host')
    const { change } = instance.setupState as any

    expect(calls).toEqual(['pre 0', 'sync 0', 'render 0'])
    calls.length = 0

    await nextTick()
    expect(calls).toEqual(['post 0'])
    calls.length = 0

    change()
    expect(calls).toEqual(['sync cleanup 0', 'sync 1'])
    calls.length = 0

    await nextTick()
    expect(calls).toEqual([
      'pre cleanup 0',
      'pre 1',
      'render cleanup 0',
      'render 1',
      'post cleanup 0',
      'post 1',
    ])
  })
})
