import { defineComponent } from 'vue'
import {
  nextTick,
  onBeforeUpdate,
  onEffectCleanup,
  onUpdated,
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
const createDemo = (
  setupFn: (porps: any, ctx: any) => any,
  renderFn: (ctx: any) => any,
) => {
  const demo = defineComponent({
    setup(...args) {
      const returned = setupFn(...args)
      Object.defineProperty(returned, '__isScriptSetup', {
        enumerable: false,
        value: true,
      })
      return returned
    },
  })
  demo.render = (ctx: any) => {
    const t0 = template('<div></div>')
    renderFn(ctx)
    return t0()
  }
  return () => render(demo as any, {}, '#host')
}

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

  test('should run with the scheduling order', async () => {
    const calls: string[] = []

    const mount = createDemo(
      () => {
        // setup
        const source = ref(0)
        const renderSource = ref(0)
        const change = () => source.value++
        const changeRender = () => renderSource.value++

        // Life Cycle Hooks
        onUpdated(() => {
          calls.push(`updated ${source.value}`)
        })
        onBeforeUpdate(() => {
          calls.push(`beforeUpdate ${source.value}`)
        })

        // Watch API
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
        return { source, change, renderSource, changeRender }
      },
      // render
      _ctx => {
        // Render Watch API
        renderEffect(() => {
          const current = _ctx.renderSource
          calls.push(`renderEffect ${current}`)
          onEffectCleanup(() => calls.push(`renderEffect cleanup ${current}`))
        })
        renderWatch(
          () => _ctx.renderSource,
          value => {
            calls.push(`renderWatch ${value}`)
            onEffectCleanup(() => calls.push(`renderWatch cleanup ${value}`))
          },
        )
      },
    )

    // Mount
    const instance = mount()
    const { change, changeRender } = instance.setupState as any

    expect(calls).toEqual(['pre 0', 'sync 0', 'renderEffect 0'])
    calls.length = 0

    await nextTick()
    expect(calls).toEqual(['post 0'])
    calls.length = 0

    // Update
    changeRender()
    change()

    expect(calls).toEqual(['sync cleanup 0', 'sync 1'])
    calls.length = 0

    await nextTick()
    expect(calls).toEqual([
      'pre cleanup 0',
      'pre 1',
      'beforeUpdate 1',
      'renderEffect cleanup 0',
      'renderEffect 1',
      'renderWatch 1',
      'post cleanup 0',
      'post 1',
      'updated 1',
    ])
  })

  test('errors should include the execution location with beforeUpdate hook', async () => {
    const mount = createDemo(
      // setup
      () => {
        const source = ref()
        const update = () => source.value++
        onBeforeUpdate(() => {
          throw 'error in beforeUpdate'
        })
        return { source, update }
      },
      // render
      ctx => {
        renderEffect(() => {
          ctx.source
        })
      },
    )

    const instance = mount()
    const { update } = instance.setupState as any
    await expect(async () => {
      update()
      await nextTick()
    }).rejects.toThrow('error in beforeUpdate')

    expect(
      '[Vue warn] Unhandled error during execution of beforeUpdate hook',
    ).toHaveBeenWarned()
  })

  test('errors should include the execution location with updated hook', async () => {
    const mount = createDemo(
      // setup
      () => {
        const source = ref(0)
        const update = () => source.value++
        onUpdated(() => {
          throw 'error in updated'
        })
        return { source, update }
      },
      // render
      ctx => {
        renderEffect(() => {
          ctx.source
        })
      },
    )

    const instance = mount()
    const { update } = instance.setupState as any
    await expect(async () => {
      update()
      await nextTick()
    }).rejects.toThrow('error in updated')

    expect(
      '[Vue warn] Unhandled error during execution of updated',
    ).toHaveBeenWarned()
  })
})
