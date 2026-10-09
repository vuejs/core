import {
  EffectScope,
  type GenericComponentInstance,
  currentInstance,
  getCurrentScope,
  nextTick,
  onBeforeUpdate,
  onUpdated,
  ref,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from '@vue/runtime-dom'
import { renderEffect, template } from '../src'
import { RenderEffect } from '../src/renderEffect'
import { onEffectCleanup } from '@vue/reactivity'
import { compile, makeRender } from './_utils'

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
  test('initializes noLifecycle effect with raw effect function', () => {
    let calls = 0
    const fn = () => {
      calls++
    }
    const effect = new RenderEffect(fn, true)

    expect(effect.fn).toBe(fn)
    expect(effect.updateJob).toBe(undefined)

    effect.run()
    expect(calls).toBe(1)
  })

  test('creates update lifecycle job lazily', async () => {
    const effect = new RenderEffect(() => {})
    expect(effect.updateJob).toBe(undefined)

    const effects: RenderEffect[] = []
    const calls: string[] = []
    const { instance } = createDemo(
      () => {
        const source = ref(0)
        const update = () => source.value++
        onUpdated(() => calls.push(`updated ${source.value}`))
        return { source, update }
      },
      ctx => {
        const effect = new RenderEffect(() => {
          calls.push(`render ${ctx.source}`)
        })
        effects.push(effect)
        effect.run()
      },
    ).render()

    expect(effects[0].updateJob).toBe(undefined)
    expect(calls).toEqual(['render 0'])

    const { update } = instance?.setupState as any
    update()
    await nextTick()

    expect(effects[0].updateJob).toEqual(expect.any(Function))
    expect(calls).toEqual(['render 0', 'render 1', 'updated 1'])
  })

  test('creates update lifecycle job after hooks are registered late', async () => {
    const effects: RenderEffect[] = []
    const calls: string[] = []
    const { instance } = createDemo(
      () => {
        const source = ref(0)
        const update = () => source.value++
        const effect = new RenderEffect(() => {
          calls.push(`render ${source.value}`)
        })
        effects.push(effect)
        effect.run()
        onUpdated(() => calls.push(`updated ${source.value}`))
        return { update }
      },
      () => {},
    ).render()

    expect(effects[0].updateJob).toBe(undefined)
    expect(calls).toEqual(['render 0'])

    const { update } = instance?.setupState as any
    update()
    await nextTick()

    expect(effects[0].updateJob).toEqual(expect.any(Function))
    expect(calls).toEqual(['render 0', 'render 1', 'updated 1'])
  })

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

    await nextTick()
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
      'renderEffect cleanup 0',
      'beforeUpdate 1',
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
      'renderEffect cleanup 1',
      'beforeUpdate 2',
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
    expect(
      '[Vue warn]: Unhandled error during execution of component update',
    ).toHaveBeenWarned()
  })

  test('should restore update state when render throws during update', async () => {
    const calls: string[] = []
    const { instance } = createDemo(
      // setup
      () => {
        const source = ref(0)
        const update = () => source.value++
        onBeforeUpdate(() => calls.push(`beforeUpdate ${source.value}`))
        onUpdated(() => calls.push(`updated ${source.value}`))
        return { source, update }
      },
      // render
      ctx => {
        renderEffect(() => {
          calls.push(`render ${ctx.source}`)
          if (ctx.source === 1) {
            throw new Error('error in render')
          }
        })
      },
    ).render()

    const { update } = instance?.setupState as any
    expect(calls).toEqual(['render 0'])
    calls.length = 0

    update()
    await expect(nextTick()).rejects.toThrow('error in render')
    expect(
      '[Vue warn]: Unhandled error during execution of component update',
    ).toHaveBeenWarned()
    expect(currentInstance).toBe(null)
    expect((instance as any).isUpdating).toBe(false)

    calls.length = 0
    update()
    await nextTick()
    expect(calls).toEqual(['beforeUpdate 2', 'render 2', 'updated 2'])
    expect((instance as any).isUpdating).toBe(false)
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
    let instanceSnap: GenericComponentInstance | null = null
    let scopeSnap: EffectScope | undefined = undefined
    const { instance } = define(() => {
      scope.run(() => {
        renderEffect(() => {
          source.value
          instanceSnap = currentInstance
          scopeSnap = getCurrentScope()
        })
      })
      return []
    }).render()

    expect(instanceSnap).toBe(instance)
    expect(scopeSnap).toBe(scope)

    source.value++
    await nextTick()
    expect(instanceSnap).toBe(instance)
    expect(scopeSnap).toBe(scope)
  })

  test.each([10, 100, 300])(
    'scans %i select callbacks once when their row effects update',
    async count => {
      const data = ref({
        rows: Array.from({ length: count }, (_, id) => ({
          id,
          value: 'b',
          count: 0,
        })),
      })
      const App = compile(
        `<template><div v-for="row in data.rows" :key="row.id"><select :value="row.value"><option value="a">A</option><option value="b">B</option></select><span>{{ row.count }}</span></div></template>`,
        data,
      )
      const { instance, host, app } = define(App).render()
      try {
        await nextTick()
        let reads = 0
        instance!.selectUpdates = new Proxy(instance!.selectUpdates!, {
          get(target, key, receiver) {
            if (typeof key === 'string' && /^\d+$/.test(key)) reads++
            return Reflect.get(target, key, receiver)
          },
        })
        for (const row of data.value.rows) row.count++
        await nextTick()
        expect(reads).toBe(count)
        expect(
          Array.from(host.querySelectorAll('select'), select => select.value),
        ).toEqual(Array(count).fill('b'))
      } finally {
        app.unmount()
      }
    },
  )

  test('syncs a value first registered during an update only once', async () => {
    const stringify = vi.fn(() => 'b')
    const data = ref({
      show: false,
      value: { toString: stringify },
      other: 'a',
    })
    const App = compile(
      `<template><select :value="data.other"><option value="a">A</option></select><select v-if="data.show" :value="data.value"><option value="a">A</option><option value="b">B</option></select></template>`,
      data,
    )
    const { host, app } = define(App).render()
    try {
      await nextTick()
      data.value.show = true
      await nextTick()
      expect(host.querySelectorAll('select')[1].value).toBe('b')
      // Initial DOM property + attribute writes, then one deferred sync.
      expect(stringify).toHaveBeenCalledTimes(3)
      stringify.mockClear()
      data.value.show = false
      await nextTick()
      expect(stringify).not.toHaveBeenCalled()
    } finally {
      app.unmount()
    }
  })
})
