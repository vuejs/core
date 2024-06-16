import {
  EffectScope,
  getCurrentScope,
  nextTick,
  onBeforeUpdate,
  onEffectCleanup,
  onUpdated,
  ref,
  renderEffect,
  template,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from '../src'
import {
  type ComponentInternalInstance,
  currentInstance,
} from '../src/component'
import { makeRender } from './_utils'

const define = makeRender<any>()
const createDemo = (setupFn: () => any, renderFn: (ctx: any) => any) =>
  define({
    setup: () => {
      const returned = setupFn()
      Object.defineProperty(returned, '__isScriptSetup', {
        enumerable: false,
        value: true,
      })
      return returned
    },
    render: (ctx: any) => {
      const t0 = template('<div></div>')
      renderFn(ctx)
      return t0()
    },
  })

describe('renderEffect', () => {
  test('basic', async () => {
    let dummy: any
    const source = ref(0)
    renderEffect(() => {
      dummy = source.value
    })
    expect(dummy).toBe(0)
    await nextTick()
    expect(dummy).toBe(0)

    source.value++
    expect(dummy).toBe(0)
    await nextTick()
    expect(dummy).toBe(1)

    source.value++
    expect(dummy).toBe(1)
    await nextTick()
    expect(dummy).toBe(2)

    source.value++
    expect(dummy).toBe(2)
    await nextTick()
    expect(dummy).toBe(3)
  })

  test('should run with the scheduling order', async () => {
    const calls: string[] = []

    const { instance } = createDemo(
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
      },
    ).render()
    const { change, changeRender } = instance?.setupState as any

    expect(calls).toEqual(['pre 0', 'sync 0', 'renderEffect 0', 'post 0'])
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
      'post cleanup 0',
      'post 1',
      'updated 1',
    ])
    calls.length = 0

    // Update
    changeRender()
    change()

    expect(calls).toEqual(['sync cleanup 1', 'sync 2'])
    calls.length = 0

    await nextTick()
    expect(calls).toEqual([
      'pre cleanup 1',
      'pre 2',
      'beforeUpdate 2',
      'renderEffect cleanup 1',
      'renderEffect 2',
      'post cleanup 1',
      'post 2',
      'updated 2',
    ])
  })

  test('errors should include the execution location with beforeUpdate hook', async () => {
    const { instance } = createDemo(
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
    ).render()
    const { update } = instance?.setupState as any
    await expect(async () => {
      update()
      await nextTick()
    }).rejects.toThrow('error in beforeUpdate')

    expect(
      '[Vue warn]: Unhandled error during execution of beforeUpdate hook',
    ).toHaveBeenWarned()
  })

  test('errors should include the execution location with updated hook', async () => {
    const { instance } = createDemo(
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
    ).render()

    const { update } = instance?.setupState as any
    await expect(async () => {
      update()
      await nextTick()
    }).rejects.toThrow('error in updated')

    expect(
      '[Vue warn]: Unhandled error during execution of updated',
    ).toHaveBeenWarned()
  })

  test('should be called with the current instance and current scope', async () => {
    const source = ref(0)
    const scope = new EffectScope()
    let instanceSnap: ComponentInternalInstance | null = null
    let scopeSnap: EffectScope | undefined = undefined
    const { instance } = define(() => {
      scope.run(() => {
        renderEffect(() => {
          instanceSnap = currentInstance
          scopeSnap = getCurrentScope()
        })
      })
    }).render()

    expect(instanceSnap).toBe(instance)
    expect(scopeSnap).toBe(scope)

    source.value++
    await nextTick()
    expect(instanceSnap).toBe(instance)
    expect(scopeSnap).toBe(scope)
  })
})
