import { defineComponent } from 'vue'
import {
  nextTick,
  onEffectCleanup,
  ref,
  render,
  renderEffect,
  renderWatch,
  template,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from '../src'

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

describe('renderWatch', () => {
  test('effect', async () => {
    let dummy: any
    const source = ref(0)
    renderEffect(() => {
      dummy = source.value
    })
    await nextTick()
    expect(dummy).toBe(0)
    source.value++
    await nextTick()
    expect(dummy).toBe(1)
  })

  test('watch', async () => {
    let dummy: any
    const source = ref(0)
    renderWatch(source, () => {
      dummy = source.value
    })
    await nextTick()
    expect(dummy).toBe(undefined)
    source.value++
    await nextTick()
    expect(dummy).toBe(1)
  })

  test('scheduling order', async () => {
    const calls: string[] = []

    const demo = defineComponent({
      setup() {
        const source = ref(0)
        const renderSource = ref(0)
        const change = () => source.value++
        const changeRender = () => renderSource.value++

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
        const __returned__ = { source, change, renderSource, changeRender }
        Object.defineProperty(__returned__, '__isScriptSetup', {
          enumerable: false,
          value: true,
        })
        return __returned__
      },
    })

    demo.render = (_ctx: any) => {
      const t0 = template('<div></div>')
      renderEffect(() => {
        const current = _ctx.renderSource
        calls.push(`renderEffect ${current}`)
        onEffectCleanup(() => calls.push(`renderEffect cleanup ${current}`))
      })
      renderWatch(
        () => _ctx.renderSource,
        (value) => {
          calls.push(`renderWatch ${value}`)
          onEffectCleanup(() => calls.push(`renderWatch cleanup ${value}`))
        },
      )
      return t0()
    }

    const instance = render(demo as any, {}, '#host')
    const { change, changeRender } = instance.setupState as any

    expect(calls).toEqual(['pre 0', 'sync 0', 'renderEffect 0'])
    calls.length = 0

    await nextTick()
    expect(calls).toEqual(['post 0'])
    calls.length = 0

    changeRender()
    change()
    expect(calls).toEqual(['sync cleanup 0', 'sync 1'])
    calls.length = 0

    await nextTick()
    expect(calls).toEqual([
      'pre cleanup 0',
      'pre 1',
      'renderEffect cleanup 0',
      'renderEffect 1',
      'renderWatch 1',
      'post cleanup 0',
      'post 1',
    ])
  })
})
