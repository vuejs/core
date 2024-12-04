import {
  type DebuggerEvent,
  type InjectionKey,
  type Ref,
  TrackOpTypes,
  TriggerOpTypes,
  createComponent,
  createIf,
  createTextNode,
  getCurrentInstance,
  inject,
  nextTick,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onRenderTracked,
  onRenderTriggered,
  onUnmounted,
  onUpdated,
  provide,
  reactive,
  ref,
  renderEffect,
  setText,
  template,
} from '../src'
import { makeRender } from './_utils'
import { ITERATE_KEY } from '@vue/reactivity'

const define = makeRender<any>()

describe('api: lifecycle hooks', () => {
  it('onBeforeMount', () => {
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe(``)
    })
    const { render, host } = define({
      setup() {
        onBeforeMount(fn)
        return () => template('<div></div>')()
      },
    })
    render()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onMounted', () => {
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe(``)
    })
    const { render, host } = define({
      setup() {
        onMounted(fn)
        return () => template('<div></div>')()
      },
    })
    render()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onBeforeUpdate', async () => {
    const count = ref(0)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('0')
    })
    const { render, host } = define({
      setup() {
        onBeforeUpdate(fn)
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => {
            setText(n0, count.value)
          })
          return n0
        })()
      },
    })
    render()
    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('1')
  })

  it('state mutation in onBeforeUpdate', async () => {
    const count = ref(0)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('0')
      count.value++
    })
    const renderSpy = vi.fn()

    const { render, host } = define({
      setup() {
        onBeforeUpdate(fn)
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => {
            renderSpy()
            setText(n0, count.value)
          })
          return n0
        })()
      },
    })
    render()
    expect(renderSpy).toHaveBeenCalledTimes(1)
  })

  it('onUpdated', async () => {
    const count = ref(0)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('1')
    })

    const { render, host } = define({
      setup() {
        onUpdated(fn)
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => {
            setText(n0, count.value)
          })
          return n0
        })()
      },
    })
    render()

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onBeforeUnmount', async () => {
    const toggle = ref(true)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('<div></div>')
    })
    const { render, host } = define({
      setup() {
        return (() => {
          const n0 = createIf(
            () => toggle.value,
            () => createComponent(Child),
          )
          return n0
        })()
      },
    })

    const Child = {
      setup() {
        onBeforeUnmount(fn)
        return (() => {
          const t0 = template('<div></div>')
          const n0 = t0()
          return n0
        })()
      },
    }

    render()

    toggle.value = false
    await nextTick()
    // expect(fn).toHaveBeenCalledTimes(1) // FIXME: not called
    expect(host.innerHTML).toBe('<!--if-->')
  })

  it('onUnmounted', async () => {
    const toggle = ref(true)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('<div></div>')
    })
    const { render, host } = define({
      setup() {
        return (() => {
          const n0 = createIf(
            () => toggle.value,
            () => createComponent(Child),
          )
          return n0
        })()
      },
    })

    const Child = {
      setup() {
        onUnmounted(fn)
        return (() => {
          const t0 = template('<div></div>')
          const n0 = t0()
          return n0
        })()
      },
    }

    render()

    toggle.value = false
    await nextTick()
    // expect(fn).toHaveBeenCalledTimes(1) // FIXME: not called
    expect(host.innerHTML).toBe('<!--if-->')
  })

  it('onBeforeUnmount in onMounted', async () => {
    const toggle = ref(true)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('<div></div>')
    })
    const { render, host } = define({
      setup() {
        return (() => {
          const n0 = createIf(
            () => toggle.value,
            () => createComponent(Child),
          )
          return n0
        })()
      },
    })

    const Child = {
      setup() {
        onMounted(() => {
          onBeforeUnmount(fn)
        })
        return (() => {
          const t0 = template('<div></div>')
          const n0 = t0()
          return n0
        })()
      },
    }

    render()

    toggle.value = false
    await nextTick()
    // expect(fn).toHaveBeenCalledTimes(1) // FIXME: not called
    expect(host.innerHTML).toBe('<!--if-->')
  })

  it('lifecycle call order', async () => {
    const count = ref(0)
    const toggle = ref(true)
    const calls: string[] = []

    const { render } = define({
      setup() {
        onBeforeMount(() => calls.push('onBeforeMount'))
        onMounted(() => calls.push('onMounted'))
        onBeforeUpdate(() => calls.push('onBeforeUpdate'))
        onUpdated(() => calls.push('onUpdated'))
        onBeforeUnmount(() => calls.push('onBeforeUnmount'))
        onUnmounted(() => calls.push('onUnmounted'))
        return (() => {
          const n0 = createIf(
            () => toggle.value,
            () => createComponent(Mid, { count: () => count.value }),
          )
          return n0
        })()
      },
    })

    const Mid = {
      props: ['count'],
      setup(props: any) {
        onBeforeMount(() => calls.push('mid onBeforeMount'))
        onMounted(() => calls.push('mid onMounted'))
        onBeforeUpdate(() => calls.push('mid onBeforeUpdate'))
        onUpdated(() => calls.push('mid onUpdated'))
        onBeforeUnmount(() => calls.push('mid onBeforeUnmount'))
        onUnmounted(() => calls.push('mid onUnmounted'))
        return (() => {
          const n0 = createComponent(Child, { count: () => props.count })
          return n0
        })()
      },
    }

    const Child = {
      props: ['count'],
      setup(props: any) {
        onBeforeMount(() => calls.push('child onBeforeMount'))
        onMounted(() => calls.push('child onMounted'))
        onBeforeUpdate(() => calls.push('child onBeforeUpdate'))
        onUpdated(() => calls.push('child onUpdated'))
        onBeforeUnmount(() => calls.push('child onBeforeUnmount'))
        onUnmounted(() => calls.push('child onUnmounted'))
        return (() => {
          const t0 = template('<div></div>')
          const n0 = t0()
          renderEffect(() => setText(n0, props.count))
          return n0
        })()
      },
    }

    // mount
    render()
    expect(calls).toEqual([
      'onBeforeMount',
      'mid onBeforeMount',
      'child onBeforeMount',
      'child onMounted',
      'mid onMounted',
      'onMounted',
    ])

    calls.length = 0

    // update
    count.value++
    await nextTick()
    // FIXME: not called
    // expect(calls).toEqual([
    //   'root onBeforeUpdate',
    //   'mid onBeforeUpdate',
    //   'child onBeforeUpdate',
    //   'child onUpdated',
    //   'mid onUpdated',
    //   'root onUpdated',
    // ])

    calls.length = 0

    // unmount
    toggle.value = false
    // FIXME: not called
    // expect(calls).toEqual([
    //   'root onBeforeUnmount',
    //   'mid onBeforeUnmount',
    //   'child onBeforeUnmount',
    //   'child onUnmounted',
    //   'mid onUnmounted',
    //   'root onUnmounted',
    // ])
  })

  it('onRenderTracked', async () => {
    const events: DebuggerEvent[] = []
    const onTrack = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive({ foo: 1, bar: 2 })

    const { render } = define({
      setup() {
        onRenderTracked(onTrack)
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => {
            setText(n0, [obj.foo, 'bar' in obj, Object.keys(obj).join('')])
          })
          return n0
        })()
      },
    })

    render()
    expect(onTrack).toHaveBeenCalledTimes(3)
    expect(events).toMatchObject([
      {
        target: obj,
        type: TrackOpTypes.GET,
        key: 'foo',
      },
      {
        target: obj,
        type: TrackOpTypes.HAS,
        key: 'bar',
      },
      {
        target: obj,
        type: TrackOpTypes.ITERATE,
        key: ITERATE_KEY,
      },
    ])
  })

  it('onRenderTrigger', async () => {
    const events: DebuggerEvent[] = []
    const onTrigger = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive<{
      foo: number
      bar?: number
    }>({ foo: 1, bar: 2 })

    const { render } = define({
      setup() {
        onRenderTriggered(onTrigger)
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => {
            setText(n0, [obj.foo, 'bar' in obj, Object.keys(obj).join('')])
          })
          return n0
        })()
      },
    })

    render()

    obj.foo++
    await nextTick()
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(events[0]).toMatchObject({
      type: TriggerOpTypes.SET,
      key: 'foo',
      oldValue: 1,
      newValue: 2,
    })

    delete obj.bar
    await nextTick()
    expect(onTrigger).toHaveBeenCalledTimes(2)
    expect(events[1]).toMatchObject({
      type: TriggerOpTypes.DELETE,
      key: 'bar',
      oldValue: 2,
    })
    ;(obj as any).baz = 3
    await nextTick()
    expect(onTrigger).toHaveBeenCalledTimes(3)
    expect(events[2]).toMatchObject({
      type: TriggerOpTypes.ADD,
      key: 'baz',
      newValue: 3,
    })
  })

  it('runs shared hook fn for each instance', async () => {
    const fn = vi.fn()
    const toggle = ref(true)
    const { render } = define({
      setup() {
        return createIf(
          () => toggle.value,
          () => [createComponent(Child), createComponent(Child)],
        )
      },
    })
    const Child = {
      setup() {
        onBeforeMount(fn)
        onBeforeUnmount(fn)
        return template('<div></div>')()
      },
    }

    render()
    expect(fn).toHaveBeenCalledTimes(2)
    toggle.value = false
    await nextTick()
    // expect(fn).toHaveBeenCalledTimes(4) // FIXME: not called unmounted hook
  })

  // #136
  it('should trigger updated hooks across components. (parent -> child)', async () => {
    const handleUpdated = vi.fn()
    const handleUpdatedChild = vi.fn()

    const count = ref(0)

    const { render, host } = define({
      setup() {
        onUpdated(() => handleUpdated())
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => setText(n0, count.value))
          const n1 = createComponent(Child, { count: () => count.value })
          return [n0, n1]
        })()
      },
    })

    const Child = {
      props: { count: Number },
      setup() {
        onUpdated(() => handleUpdatedChild())
        return (() => {
          const props = getCurrentInstance()!.props
          const n2 = createTextNode()
          renderEffect(() => setText(n2, props.count))
          return n2
        })()
      },
    }

    render()

    expect(host.innerHTML).toBe('00')
    expect(handleUpdated).toHaveBeenCalledTimes(0)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(0)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('11')
    expect(handleUpdated).toHaveBeenCalledTimes(1)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(1)
  })

  // #136
  it('should trigger updated hooks across components. (child -> parent)', async () => {
    const handleUpdated = vi.fn()
    const handleUpdatedChild = vi.fn()

    const key: InjectionKey<Ref<number>> = Symbol()

    const { render, host } = define({
      setup() {
        const count = ref(0)
        provide(key, count)
        onUpdated(() => handleUpdated())
        return (() => {
          const n0 = createTextNode()
          renderEffect(() => setText(n0, count.value))
          const n1 = createComponent(Child, { count: () => count.value })
          return [n0, n1]
        })()
      },
    })

    let update: any
    const Child = {
      props: { count: Number },
      setup() {
        onUpdated(() => handleUpdatedChild())
        const count = inject(key)!
        update = () => count.value++
        return (() => {
          const n2 = createTextNode()
          renderEffect(() => setText(n2, count.value))
          return n2
        })()
      },
    }

    render()

    expect(host.innerHTML).toBe('00')
    expect(handleUpdated).toHaveBeenCalledTimes(0)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(0)

    update()
    await nextTick()
    expect(host.innerHTML).toBe('11')
    expect(handleUpdated).toHaveBeenCalledTimes(1)
    expect(handleUpdatedChild).toHaveBeenCalledTimes(1)
  })
})
