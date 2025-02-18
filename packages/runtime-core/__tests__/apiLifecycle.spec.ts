import {
  KeepAlive,
  TrackOpTypes,
  h,
  nextTick,
  nodeOps,
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onRenderTracked,
  onRenderTriggered,
  onUnmounted,
  onUpdated,
  reactive,
  ref,
  render,
  serializeInner,
} from '@vue/runtime-test'
import {
  type DebuggerEvent,
  ITERATE_KEY,
  TriggerOpTypes,
} from '@vue/reactivity'

describe('api: lifecycle hooks', () => {
  it('onBeforeMount', () => {
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called before inner div is rendered
      expect(serializeInner(root)).toBe(``)
    })

    const Comp = {
      setup() {
        onBeforeMount(fn)
        return () => h('div')
      },
    }
    render(h(Comp), root)
    expect(fn).toHaveBeenCalledTimes(1)
    // #10863
    expect(fn).toHaveBeenCalledWith()
  })

  it('onMounted', () => {
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called after inner div is rendered
      expect(serializeInner(root)).toBe(`<div></div>`)
    })

    const Comp = {
      setup() {
        onMounted(fn)
        return () => h('div')
      },
    }
    render(h(Comp), root)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onBeforeUpdate', async () => {
    const count = ref(0)
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called before inner div is updated
      expect(serializeInner(root)).toBe(`<div>0</div>`)
    })

    const Comp = {
      setup() {
        onBeforeUpdate(fn)
        return () => h('div', count.value)
      },
    }
    render(h(Comp), root)

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(serializeInner(root)).toBe(`<div>1</div>`)
  })

  it('state mutation in onBeforeUpdate', async () => {
    const count = ref(0)
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called before inner div is updated
      expect(serializeInner(root)).toBe(`<div>0</div>`)
      count.value++
    })
    const renderSpy = vi.fn()

    const Comp = {
      setup() {
        onBeforeUpdate(fn)
        return () => {
          renderSpy()
          return h('div', count.value)
        }
      },
    }
    render(h(Comp), root)
    expect(renderSpy).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(renderSpy).toHaveBeenCalledTimes(2)
    expect(serializeInner(root)).toBe(`<div>2</div>`)
  })

  it('onUpdated', async () => {
    const count = ref(0)
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called after inner div is updated
      expect(serializeInner(root)).toBe(`<div>1</div>`)
    })

    const Comp = {
      setup() {
        onUpdated(fn)
        return () => h('div', count.value)
      },
    }
    render(h(Comp), root)

    count.value++
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onBeforeUnmount', async () => {
    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called before inner div is removed
      expect(serializeInner(root)).toBe(`<div></div>`)
    })

    const Comp = {
      setup() {
        return () => (toggle.value ? h(Child) : null)
      },
    }

    const Child = {
      setup() {
        onBeforeUnmount(fn)
        return () => h('div')
      },
    }

    render(h(Comp), root)

    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onUnmounted', async () => {
    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called after inner div is removed
      expect(serializeInner(root)).toBe(`<!---->`)
    })

    const Comp = {
      setup() {
        return () => (toggle.value ? h(Child) : null)
      },
    }

    const Child = {
      setup() {
        onUnmounted(fn)
        return () => h('div')
      },
    }

    render(h(Comp), root)

    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('onBeforeUnmount in onMounted', async () => {
    const toggle = ref(true)
    const root = nodeOps.createElement('div')
    const fn = vi.fn(() => {
      // should be called before inner div is removed
      expect(serializeInner(root)).toBe(`<div></div>`)
    })

    const Comp = {
      setup() {
        return () => (toggle.value ? h(Child) : null)
      },
    }

    const Child = {
      setup() {
        onMounted(() => {
          onBeforeUnmount(fn)
        })
        return () => h('div')
      },
    }

    render(h(Comp), root)

    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('lifecycle call order', async () => {
    const count = ref(0)
    const root = nodeOps.createElement('div')
    const calls: string[] = []

    const Root = {
      setup() {
        onBeforeMount(() => calls.push('root onBeforeMount'))
        onMounted(() => calls.push('root onMounted'))
        onBeforeUpdate(() => calls.push('root onBeforeUpdate'))
        onUpdated(() => calls.push('root onUpdated'))
        onBeforeUnmount(() => calls.push('root onBeforeUnmount'))
        onUnmounted(() => calls.push('root onUnmounted'))
        return () => h(Mid, { count: count.value })
      },
    }

    const Mid = {
      props: ['count'],
      setup(props: any) {
        onBeforeMount(() => calls.push('mid onBeforeMount'))
        onMounted(() => calls.push('mid onMounted'))
        onBeforeUpdate(() => calls.push('mid onBeforeUpdate'))
        onUpdated(() => calls.push('mid onUpdated'))
        onBeforeUnmount(() => calls.push('mid onBeforeUnmount'))
        onUnmounted(() => calls.push('mid onUnmounted'))
        return () => h(Child, { count: props.count })
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
        return () => h('div', props.count)
      },
    }

    // mount
    render(h(Root), root)
    expect(calls).toEqual([
      'root onBeforeMount',
      'mid onBeforeMount',
      'child onBeforeMount',
      'child onMounted',
      'mid onMounted',
      'root onMounted',
    ])

    calls.length = 0

    // update
    count.value++
    await nextTick()
    expect(calls).toEqual([
      'root onBeforeUpdate',
      'mid onBeforeUpdate',
      'child onBeforeUpdate',
      'child onUpdated',
      'mid onUpdated',
      'root onUpdated',
    ])

    calls.length = 0

    // unmount
    render(null, root)
    expect(calls).toEqual([
      'root onBeforeUnmount',
      'mid onBeforeUnmount',
      'child onBeforeUnmount',
      'child onUnmounted',
      'mid onUnmounted',
      'root onUnmounted',
    ])
  })

  it('onRenderTracked', () => {
    const events: DebuggerEvent[] = []
    const onTrack = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive({ foo: 1, bar: 2 })

    const Comp = {
      setup() {
        onRenderTracked(onTrack)
        return () =>
          h('div', [obj.foo, 'bar' in obj, Object.keys(obj).join('')])
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
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

  it('onRenderTriggered', async () => {
    const events: DebuggerEvent[] = []
    const onTrigger = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive<{
      foo: number
      bar?: number
    }>({ foo: 1, bar: 2 })

    const Comp = {
      setup() {
        onRenderTriggered(onTrigger)
        return () =>
          h('div', [obj.foo, 'bar' in obj, Object.keys(obj).join('')])
      },
    }

    render(h(Comp), nodeOps.createElement('div'))

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
    const Comp = {
      setup() {
        return () => (toggle.value ? [h(Child), h(Child)] : null)
      },
    }
    const Child = {
      setup() {
        onMounted(fn)
        onBeforeUnmount(fn)
        return () => h('div')
      },
    }

    render(h(Comp), nodeOps.createElement('div'))
    expect(fn).toHaveBeenCalledTimes(2)
    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('immediately trigger unmount during rendering', async () => {
    const fn = vi.fn()
    const toggle = ref(false)

    const Child = {
      setup() {
        onMounted(fn)
        // trigger unmount immediately
        toggle.value = false
        return () => h('div')
      },
    }

    const Comp = {
      setup() {
        return () => (toggle.value ? [h(Child)] : null)
      },
    }

    render(h(Comp), nodeOps.createElement('div'))

    toggle.value = true
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(0)
  })

  it('immediately trigger unmount during rendering(with KeepAlive)', async () => {
    const mountedSpy = vi.fn()
    const activeSpy = vi.fn()
    const toggle = ref(false)

    const Child = {
      setup() {
        onMounted(mountedSpy)
        onActivated(activeSpy)

        // trigger unmount immediately
        toggle.value = false
        return () => h('div')
      },
    }

    const Comp = {
      setup() {
        return () => h(KeepAlive, [toggle.value ? h(Child) : null])
      },
    }

    render(h(Comp), nodeOps.createElement('div'))

    toggle.value = true
    await nextTick()
    expect(mountedSpy).toHaveBeenCalledTimes(0)
    expect(activeSpy).toHaveBeenCalledTimes(0)
  })
})
