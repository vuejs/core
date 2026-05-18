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
import {
  renderEffect,
  setAttrBinding,
  setBlockHtmlBinding,
  setBlockTextBinding,
  setClassBinding,
  setClassNameBinding,
  setDOMPropBinding,
  setDynamicEventsBinding,
  setDynamicPropsBinding,
  setEventBinding,
  setHtmlBinding,
  setPropBinding,
  setStyleBinding,
  setTextBinding,
  setValueBinding,
  template,
} from '../src'
import { RenderEffect } from '../src/renderEffect'
import { onEffectCleanup } from '@vue/reactivity'
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

  test('setTextBinding updates text with render lifecycle', async () => {
    const calls: string[] = []
    const { instance, html } = define({
      setup() {
        const source = ref('one')
        const update = () => (source.value = 'two')
        onBeforeUpdate(() => calls.push(`beforeUpdate ${source.value}`))
        onUpdated(() => calls.push(`updated ${source.value}`))
        return { source, update }
      },
      render(ctx: any) {
        const t0 = template('<div> </div>', 1)
        const n0 = t0() as ParentNode
        setTextBinding(n0, () => ctx.source)
        return n0
      },
    }).render()

    expect(html()).toBe('<div>one</div>')
    expect(calls).toEqual([])

    const { update } = instance?.setupState as any
    update()
    await nextTick()

    expect(html()).toBe('<div>two</div>')
    expect(calls).toEqual(['beforeUpdate two', 'updated two'])
  })

  test('setTextBinding getter runs with current instance and scope', async () => {
    const source = ref('one')
    const scope = new EffectScope()
    let instanceSnap: GenericComponentInstance | null = null
    let scopeSnap: EffectScope | undefined = undefined
    const { instance, html } = define(() => {
      const t0 = template('<div> </div>', 1)
      const n0 = t0() as ParentNode
      scope.run(() => {
        setTextBinding(n0, () => {
          instanceSnap = currentInstance
          scopeSnap = getCurrentScope()
          return source.value
        })
      })
      return n0
    }).render()

    expect(html()).toBe('<div>one</div>')
    expect(instanceSnap).toBe(instance)
    expect(scopeSnap).toBe(scope)

    source.value = 'two'
    await nextTick()
    expect(html()).toBe('<div>two</div>')
    expect(instanceSnap).toBe(instance)
    expect(scopeSnap).toBe(scope)
    scope.stop()
  })

  test('DOM binding helpers update with their source values', async () => {
    let input!: HTMLInputElement
    let eventTarget!: HTMLButtonElement
    let dynamicEventTarget!: HTMLButtonElement
    const eventCalls: string[] = []
    const { instance, html } = define({
      setup() {
        const source = ref('one')
        const active = ref(true)
        const color = ref('red')
        const eventName = ref('click')
        const events = ref<Record<string, () => void>>({
          click: () => eventCalls.push(`dynamic ${source.value}`),
        })
        const update = () => {
          source.value = 'two'
          active.value = false
          color.value = 'blue'
          eventName.value = 'mouseover'
          events.value = {
            mouseover: () => eventCalls.push(`dynamic ${source.value}`),
          }
        }
        return { source, active, color, eventName, events, update }
      },
      render(ctx: any) {
        const root = document.createElement('div')
        const attr = document.createElement('div')
        const prop = document.createElement('div')
        const domProp = document.createElement('div')
        input = document.createElement('input')
        const cls = document.createElement('div')
        const clsName = document.createElement('div')
        const style = document.createElement('div')
        const html = document.createElement('div')
        const blockText = document.createElement('div')
        const blockHtml = document.createElement('div')
        const dynamic = document.createElement('div')
        eventTarget = document.createElement('button')
        dynamicEventTarget = document.createElement('button')

        root.append(
          attr,
          prop,
          domProp,
          input,
          cls,
          clsName,
          style,
          html,
          blockText,
          blockHtml,
          dynamic,
          eventTarget,
          dynamicEventTarget,
        )

        setAttrBinding(attr, 'data-test', () => ctx.source)
        setPropBinding(prop, 'id', () => ctx.source)
        setDOMPropBinding(domProp, 'title', () => ctx.source)
        setValueBinding(input, () => ctx.source)
        setClassBinding(cls, () => ctx.source)
        setClassNameBinding(clsName, () => (ctx.active ? 1 : 0), 'active')
        setStyleBinding(style, () => ({ color: ctx.color }))
        setHtmlBinding(html, () => `<span>${ctx.source}</span>`)
        setBlockTextBinding(blockText, () => ctx.source)
        setBlockHtmlBinding(blockHtml, () => `<span>${ctx.source}</span>`)
        setDynamicPropsBinding(dynamic, () => [
          { id: ctx.source, class: ctx.source },
        ])
        setEventBinding(
          eventTarget,
          () => ctx.eventName,
          () => eventCalls.push(`event ${ctx.source}`),
        )
        setDynamicEventsBinding(dynamicEventTarget, () => ctx.events)

        return root
      },
    }).render()

    expect(html()).toBe(
      '<div><div data-test="one"></div><div id="one"></div><div title="one"></div><input><div class="one"></div><div class="active"></div><div style="color: red;"></div><div><span>one</span></div><div>one</div><div><span>one</span></div><div id="one" class="one"></div><button></button><button></button></div>',
    )
    expect(input.value).toBe('one')
    eventTarget.dispatchEvent(new Event('click'))
    dynamicEventTarget.dispatchEvent(new Event('click'))
    expect(eventCalls).toEqual(['event one', 'dynamic one'])

    const { update } = instance?.setupState as any
    update()
    await nextTick()

    expect(html()).toBe(
      '<div><div data-test="two"></div><div id="two"></div><div title="two"></div><input><div class="two"></div><div class=""></div><div style="color: blue;"></div><div><span>two</span></div><div>two</div><div><span>two</span></div><div id="two" class="two"></div><button></button><button></button></div>',
    )
    expect(input.value).toBe('two')
    eventTarget.dispatchEvent(new Event('click'))
    dynamicEventTarget.dispatchEvent(new Event('click'))
    eventTarget.dispatchEvent(new Event('mouseover'))
    dynamicEventTarget.dispatchEvent(new Event('mouseover'))
    expect(eventCalls).toEqual([
      'event one',
      'dynamic one',
      'event two',
      'dynamic two',
    ])
  })

  test('setEventBinding preserves listener options across event name updates', async () => {
    let button!: HTMLButtonElement
    const calls: string[] = []
    const { instance } = define({
      setup() {
        const eventName = ref('click')
        const update = () => {
          eventName.value = 'mouseover'
        }
        return { eventName, update }
      },
      render(ctx: any) {
        button = document.createElement('button')
        setEventBinding(
          button,
          () => ctx.eventName,
          () => calls.push(ctx.eventName),
          { once: true },
        )
        return button
      },
    }).render()

    const { update } = instance?.setupState as any
    update()
    await nextTick()

    button.dispatchEvent(new Event('click'))
    button.dispatchEvent(new Event('mouseover'))
    button.dispatchEvent(new Event('mouseover'))
    expect(calls).toEqual(['mouseover'])
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
})
