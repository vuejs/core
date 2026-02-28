import {
  type DebuggerEvent,
  type InjectionKey,
  type Ref,
  TrackOpTypes,
  TriggerOpTypes,
  currentInstance,
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
} from '@vue/runtime-dom'
import {
  createComponent,
  createFor,
  createIf,
  createTextNode,
  insert,
  renderEffect,
  template,
} from '../src'
import { makeRender } from './_utils'
import { ITERATE_KEY } from '@vue/reactivity'
import { setElementText } from '../src/dom/prop'

const define = makeRender<any>()

describe('api: lifecycle hooks', () => {
  it('onBeforeMount', () => {
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe(``)
    })
    const { render, host } = define({
      setup() {
        onBeforeMount(fn)
        return []
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
        return []
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
        const n0 = createTextNode()
        renderEffect(() => {
          setElementText(n0, count.value)
        })
        return n0
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
        const n0 = createTextNode()
        renderEffect(() => {
          renderSpy()
          setElementText(n0, count.value)
        })
        return n0
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

        const n0 = createTextNode()
        renderEffect(() => {
          setElementText(n0, count.value)
        })
        return n0
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
      expect(host.innerHTML).toBe('<div></div><!--if-->')
    })
    const { render, host } = define({
      setup() {
        const n0 = createIf(
          () => toggle.value,
          () => createComponent(Child),
        )
        return n0
      },
    })

    const Child = {
      setup() {
        onBeforeUnmount(fn)

        const t0 = template('<div></div>')
        const n0 = t0()
        return n0
      },
    }

    render()

    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('<!--if-->')
  })

  it('onUnmounted', async () => {
    const toggle = ref(true)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('<!--if-->')
    })
    const { render, host } = define({
      setup() {
        const n0 = createIf(
          () => toggle.value,
          () => createComponent(Child),
        )
        return n0
      },
    })

    const Child = {
      setup() {
        onUnmounted(fn)

        const t0 = template('<div></div>')
        const n0 = t0()
        return n0
      },
    }

    render()

    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('<!--if-->')
  })

  it('onBeforeUnmount in onMounted', async () => {
    const toggle = ref(true)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('<div></div><!--if-->')
    })
    const { render, host } = define({
      setup() {
        const n0 = createIf(
          () => toggle.value,
          () => createComponent(Child),
        )
        return n0
      },
    })

    const Child = {
      setup() {
        onMounted(() => {
          onBeforeUnmount(fn)
        })

        const t0 = template('<div></div>')
        const n0 = t0()
        return n0
      },
    }

    render()

    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('<!--if-->')
  })

  it('lifecycle call order', async () => {
    const count = ref(0)
    const toggle = ref(true)
    const calls: string[] = []

    const { render } = define({
      setup() {
        onBeforeMount(() => calls.push('root onBeforeMount'))
        onMounted(() => calls.push('root onMounted'))
        onBeforeUpdate(() => calls.push('root onBeforeUpdate'))
        onUpdated(() => calls.push('root onUpdated'))
        onBeforeUnmount(() => calls.push('root onBeforeUnmount'))
        onUnmounted(() => calls.push('root onUnmounted'))

        const n0 = createIf(
          () => toggle.value,
          () => createComponent(Mid, { count: () => count.value }),
        )
        return n0
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

        const n0 = createComponent(Child, { count: () => props.count })
        return n0
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

        const t0 = template('<div></div>')
        const n0 = t0()
        renderEffect(() => setElementText(n0, props.count))
        return n0
      },
    }

    // mount
    const ctx = render()
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
    // only child updated
    expect(calls).toEqual(['child onBeforeUpdate', 'child onUpdated'])

    calls.length = 0

    // unmount
    ctx.app.unmount()
    await nextTick()
    expect(calls).toEqual([
      'root onBeforeUnmount',
      'mid onBeforeUnmount',
      'child onBeforeUnmount',
      'child onUnmounted',
      'mid onUnmounted',
      'root onUnmounted',
    ])
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

        const n0 = createTextNode()
        renderEffect(() => {
          setElementText(n0, [obj.foo, 'bar' in obj, Object.keys(obj).join('')])
        })
        return n0
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

        const n0 = createTextNode()
        renderEffect(() => {
          setElementText(n0, [obj.foo, 'bar' in obj, Object.keys(obj).join('')])
        })
        return n0
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
    expect(fn).toHaveBeenCalledTimes(4)
  })

  // #136
  it('should trigger updated hooks across components. (parent -> child)', async () => {
    const handleUpdated = vi.fn()
    const handleUpdatedChild = vi.fn()

    const count = ref(0)

    const { render, host } = define({
      setup() {
        onUpdated(() => handleUpdated())

        const n0 = createTextNode()
        renderEffect(() => setElementText(n0, count.value))
        const n1 = createComponent(Child, { count: () => count.value })
        return [n0, n1]
      },
    })

    const Child = {
      props: { count: Number },
      setup() {
        onUpdated(() => handleUpdatedChild())

        const props = currentInstance!.props
        const n2 = createTextNode()
        renderEffect(() => setElementText(n2, props.count))
        return n2
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

        const n0 = createTextNode()
        renderEffect(() => setElementText(n0, count.value))
        const n1 = createComponent(Child, { count: () => count.value })
        return [n0, n1]
      },
    })

    let update: any
    const Child = {
      props: { count: Number },
      setup() {
        onUpdated(() => handleUpdatedChild())
        const count = inject(key)!
        update = () => count.value++

        const n2 = createTextNode()
        renderEffect(() => setElementText(n2, count.value))
        return n2
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

  test('unmount hooks when nested in if block', async () => {
    const toggle = ref(true)
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('<div><span></span></div><!--if-->')
    })
    const fn2 = vi.fn(() => {
      expect(host.innerHTML).toBe('<!--if-->')
    })
    const { render, host } = define({
      setup() {
        const n0 = createIf(
          () => toggle.value,
          () => {
            const n1 = document.createElement('div')
            const n2 = createComponent(Child)
            insert(n2, n1)
            return n1
          },
        )
        return n0
      },
    })

    const Child = {
      setup() {
        onBeforeUnmount(fn)
        onUnmounted(fn2)

        const t0 = template('<span></span>')
        const n0 = t0()
        return n0
      },
    }

    render()

    toggle.value = false
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('<!--if-->')
  })

  test('unmount hooks when nested in for blocks', async () => {
    const list = ref([1])
    const fn = vi.fn(() => {
      expect(host.innerHTML).toBe('<div><span></span></div><!--for-->')
    })
    const fn2 = vi.fn(() => {
      expect(host.innerHTML).toBe('<!--for-->')
    })
    const { render, host } = define({
      setup() {
        const n0 = createFor(
          () => list.value,
          () => {
            const n1 = document.createElement('div')
            const n2 = createComponent(Child)
            insert(n2, n1)
            return n1
          },
        )
        return n0
      },
    })

    const Child = {
      setup() {
        onBeforeUnmount(fn)
        onUnmounted(fn2)

        const t0 = template('<span></span>')
        const n0 = t0()
        return n0
      },
    }

    render()

    list.value.pop()
    await nextTick()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(host.innerHTML).toBe('<!--for-->')
  })
})
