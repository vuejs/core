import {
  type ComponentInternalInstance,
  type ComponentPublicInstance,
  computed,
  defineComponent,
  getCurrentInstance,
  nextTick,
  onErrorCaptured,
  onWatcherCleanup,
  reactive,
  ref,
  watch,
  watchEffect,
} from '../src/index'
import {
  type TestElement,
  createApp,
  h,
  nodeOps,
  onMounted,
  render,
  serializeInner,
  watchPostEffect,
  watchSyncEffect,
} from '@vue/runtime-test'
import {
  type DebuggerEvent,
  ITERATE_KEY,
  type Ref,
  type ShallowRef,
  TrackOpTypes,
  TriggerOpTypes,
  effectScope,
  shallowReactive,
  shallowRef,
  toRef,
  triggerRef,
} from '@vue/reactivity'
import { renderToString } from '@vue/server-renderer'

describe('api: watch', () => {
  it('effect', async () => {
    const state = reactive({ count: 0 })
    let dummy
    watchEffect(() => {
      dummy = state.count
    })
    expect(dummy).toBe(0)

    state.count++
    await nextTick()
    expect(dummy).toBe(1)
  })

  it('watching single source: getter', async () => {
    const state = reactive({ count: 0 })
    let dummy
    watch(
      () => state.count,
      (count, prevCount) => {
        dummy = [count, prevCount]
        // assert types
        count + 1
        if (prevCount) {
          prevCount + 1
        }
      },
    )
    state.count++
    await nextTick()
    expect(dummy).toMatchObject([1, 0])
  })

  it('watching single source: ref', async () => {
    const count = ref(0)
    let dummy
    watch(count, (count, prevCount) => {
      dummy = [count, prevCount]
      // assert types
      count + 1
      if (prevCount) {
        prevCount + 1
      }
    })
    count.value++
    await nextTick()
    expect(dummy).toMatchObject([1, 0])
  })

  it('watching single source: array', async () => {
    const array = reactive([] as number[])
    const spy = vi.fn()
    watch(array, spy)
    array.push(1)
    await nextTick()
    expect(spy).toBeCalledTimes(1)
    expect(spy).toBeCalledWith([1], [1], expect.anything())
  })

  it('should not call functions inside a reactive source array', () => {
    const spy1 = vi.fn()
    const array = reactive([spy1])
    const spy2 = vi.fn()
    watch(array, spy2, { immediate: true })
    expect(spy1).toBeCalledTimes(0)
    expect(spy2).toBeCalledWith([spy1], undefined, expect.anything())
  })

  it('should not unwrap refs in a reactive source array', async () => {
    const val = ref({ foo: 1 })
    const array = reactive([val])
    const spy = vi.fn()
    watch(array, spy, { immediate: true })
    expect(spy).toBeCalledTimes(1)
    expect(spy).toBeCalledWith([val], undefined, expect.anything())

    // deep by default
    val.value.foo++
    await nextTick()
    expect(spy).toBeCalledTimes(2)
    expect(spy).toBeCalledWith([val], [val], expect.anything())
  })

  it('should not fire if watched getter result did not change', async () => {
    const spy = vi.fn()
    const n = ref(0)
    watch(() => n.value % 2, spy)

    n.value++
    await nextTick()
    expect(spy).toBeCalledTimes(1)

    n.value += 2
    await nextTick()
    // should not be called again because getter result did not change
    expect(spy).toBeCalledTimes(1)
  })

  it('watching single source: computed ref', async () => {
    const count = ref(0)
    const plus = computed(() => count.value + 1)
    let dummy
    watch(plus, (count, prevCount) => {
      dummy = [count, prevCount]
      // assert types
      count + 1
      if (prevCount) {
        prevCount + 1
      }
    })
    count.value++
    await nextTick()
    expect(dummy).toMatchObject([2, 1])
  })

  it('watching primitive with deep: true', async () => {
    const count = ref(0)
    let dummy
    watch(
      count,
      (c, prevCount) => {
        dummy = [c, prevCount]
      },
      {
        deep: true,
      },
    )
    count.value++
    await nextTick()
    expect(dummy).toMatchObject([1, 0])
  })

  it('directly watching reactive object (with automatic deep: true)', async () => {
    const src = reactive({
      count: 0,
    })
    let dummy
    watch(src, ({ count }) => {
      dummy = count
    })
    src.count++
    await nextTick()
    expect(dummy).toBe(1)
  })

  it('directly watching reactive object with explicit deep: false', async () => {
    const src = reactive({
      state: {
        count: 0,
      },
    })
    let dummy
    watch(
      src,
      ({ state }) => {
        dummy = state?.count
      },
      {
        deep: false,
      },
    )

    // nested should not trigger
    src.state.count++
    await nextTick()
    expect(dummy).toBe(undefined)

    // root level should trigger
    src.state = { count: 1 }
    await nextTick()
    expect(dummy).toBe(1)
  })

  it('directly watching reactive array with explicit deep: false', async () => {
    const val = ref(1)
    const array: any[] = reactive([val])
    const spy = vi.fn()
    watch(array, spy, { immediate: true, deep: false })
    expect(spy).toBeCalledTimes(1)
    expect(spy).toBeCalledWith([val], undefined, expect.anything())

    val.value++
    await nextTick()
    expect(spy).toBeCalledTimes(1)

    array[1] = 2
    await nextTick()
    expect(spy).toBeCalledTimes(2)
    expect(spy).toBeCalledWith([val, 2], [val, 2], expect.anything())
  })

  // #9916
  it('watching shallow reactive array with deep: false', async () => {
    class foo {
      prop1: ShallowRef<string> = shallowRef('')
      prop2: string = ''
    }

    const obj1 = new foo()
    const obj2 = new foo()

    const collection = shallowReactive([obj1, obj2])
    const cb = vi.fn()
    watch(collection, cb, { deep: false })

    collection[0].prop1.value = 'foo'
    await nextTick()
    // should not trigger
    expect(cb).toBeCalledTimes(0)

    collection.push(new foo())
    await nextTick()
    // should trigger on array self mutation
    expect(cb).toBeCalledTimes(1)
  })

  it('should still respect deep: true on shallowReactive source', async () => {
    const obj = reactive({ a: 1 })
    const arr = shallowReactive([obj])

    let dummy
    watch(
      arr,
      () => {
        dummy = arr[0].a
      },
      { deep: true },
    )

    obj.a++
    await nextTick()
    expect(dummy).toBe(2)
  })

  it('watching multiple sources', async () => {
    const state = reactive({ count: 1 })
    const count = ref(1)
    const plus = computed(() => count.value + 1)

    let dummy
    watch([() => state.count, count, plus], (vals, oldVals) => {
      dummy = [vals, oldVals]
      // assert types
      vals.concat(1)
      oldVals.concat(1)
    })

    state.count++
    count.value++
    await nextTick()
    expect(dummy).toMatchObject([
      [2, 2, 3],
      [1, 1, 2],
    ])
  })

  it('watching multiple sources: undefined initial values and immediate: true', async () => {
    const a = ref()
    const b = ref()
    let called = false
    watch(
      [a, b],
      ([newA, newB], [oldA, oldB]) => {
        called = true
        expect([newA, newB]).toMatchObject([undefined, undefined])
        expect([oldA, oldB]).toMatchObject([undefined, undefined])
      },
      { immediate: true },
    )
    await nextTick()
    expect(called).toBe(true)
  })

  it('watching multiple sources: readonly array', async () => {
    const state = reactive({ count: 1 })
    const status = ref(false)

    let dummy
    watch([() => state.count, status] as const, (vals, oldVals) => {
      dummy = [vals, oldVals]
      const [count] = vals
      const [, oldStatus] = oldVals
      // assert types
      count + 1
      oldStatus === true
    })

    state.count++
    status.value = true
    await nextTick()
    expect(dummy).toMatchObject([
      [2, true],
      [1, false],
    ])
  })

  it('watching multiple sources: reactive object (with automatic deep: true)', async () => {
    const src = reactive({ count: 0 })
    let dummy
    watch([src], ([state]) => {
      dummy = state
      // assert types
      state.count === 1
    })
    src.count++
    await nextTick()
    expect(dummy).toMatchObject({ count: 1 })
  })

  it('warn invalid watch source', () => {
    // @ts-expect-error
    watch(1, () => {})
    expect(`Invalid watch source`).toHaveBeenWarned()
  })

  it('warn invalid watch source: multiple sources', () => {
    watch([1], () => {})
    expect(`Invalid watch source`).toHaveBeenWarned()
  })

  it('stopping the watcher (effect)', async () => {
    const state = reactive({ count: 0 })
    let dummy
    const stop = watchEffect(() => {
      dummy = state.count
    })
    expect(dummy).toBe(0)

    stop()
    state.count++
    await nextTick()
    // should not update
    expect(dummy).toBe(0)
  })

  it('stopping the watcher (SSR)', async () => {
    let dummy = 0
    const count = ref<number>(1)
    const captureValue = (value: number) => {
      dummy = value
    }
    const watchCallback = vi.fn(newValue => {
      captureValue(newValue)
    })
    const Comp = defineComponent({
      created() {
        const getter = () => this.count
        captureValue(getter()) // sets dummy to 1
        const stop = this.$watch(getter, watchCallback)
        stop()
        this.count = 2 // shouldn't trigger side effect
      },
      render() {
        return h('div', this.count)
      },
      setup() {
        return { count }
      },
    })
    let html
    html = await renderToString(h(Comp))
    // should not throw here
    expect(html).toBe(`<div>2</div>`)
    expect(watchCallback).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
    await nextTick()
    count.value = 3 // shouldn't trigger side effect
    await nextTick()
    expect(watchCallback).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
  })

  it('stopping the watcher (with source)', async () => {
    const state = reactive({ count: 0 })
    let dummy
    const stop = watch(
      () => state.count,
      count => {
        dummy = count
      },
    )

    state.count++
    await nextTick()
    expect(dummy).toBe(1)

    stop()
    state.count++
    await nextTick()
    // should not update
    expect(dummy).toBe(1)
  })

  it('cleanup registration (effect)', async () => {
    const state = reactive({ count: 0 })
    const cleanup = vi.fn()
    let dummy
    const stop = watchEffect(onCleanup => {
      onCleanup(cleanup)
      dummy = state.count
    })
    expect(dummy).toBe(0)

    state.count++
    await nextTick()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)

    stop()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('cleanup registration (with source)', async () => {
    const count = ref(0)
    const cleanup = vi.fn()
    let dummy
    const stop = watch(count, (count, prevCount, onCleanup) => {
      onCleanup(cleanup)
      dummy = count
    })

    count.value++
    await nextTick()
    expect(cleanup).toHaveBeenCalledTimes(0)
    expect(dummy).toBe(1)

    count.value++
    await nextTick()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(2)

    stop()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('onWatcherCleanup', async () => {
    const count = ref(0)
    const cleanupEffect = vi.fn()
    const cleanupWatch = vi.fn()

    const stopEffect = watchEffect(() => {
      onWatcherCleanup(cleanupEffect)
      count.value
    })
    const stopWatch = watch(count, () => {
      onWatcherCleanup(cleanupWatch)
    })

    count.value++
    await nextTick()
    expect(cleanupEffect).toHaveBeenCalledTimes(1)
    expect(cleanupWatch).toHaveBeenCalledTimes(0)

    count.value++
    await nextTick()
    expect(cleanupEffect).toHaveBeenCalledTimes(2)
    expect(cleanupWatch).toHaveBeenCalledTimes(1)

    stopEffect()
    expect(cleanupEffect).toHaveBeenCalledTimes(3)
    stopWatch()
    expect(cleanupWatch).toHaveBeenCalledTimes(2)
  })

  it('flush timing: pre (default)', async () => {
    const count = ref(0)
    const count2 = ref(0)

    let callCount = 0
    let result1
    let result2
    const assertion = vi.fn((count, count2Value) => {
      callCount++
      // on mount, the watcher callback should be called before DOM render
      // on update, should be called before the count is updated
      const expectedDOM = callCount === 1 ? `` : `${count - 1}`
      result1 = serializeInner(root) === expectedDOM

      // in a pre-flush callback, all state should have been updated
      const expectedState = callCount - 1
      result2 = count === expectedState && count2Value === expectedState
    })

    const Comp = {
      setup() {
        watchEffect(() => {
          assertion(count.value, count2.value)
        })
        return () => count.value
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(assertion).toHaveBeenCalledTimes(1)
    expect(result1).toBe(true)
    expect(result2).toBe(true)

    count.value++
    count2.value++
    await nextTick()
    // two mutations should result in 1 callback execution
    expect(assertion).toHaveBeenCalledTimes(2)
    expect(result1).toBe(true)
    expect(result2).toBe(true)
  })

  it('flush timing: post', async () => {
    const count = ref(0)
    let result
    const assertion = vi.fn(count => {
      result = serializeInner(root) === `${count}`
    })

    const Comp = {
      setup() {
        watchEffect(
          () => {
            assertion(count.value)
          },
          { flush: 'post' },
        )
        return () => count.value
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(assertion).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)

    count.value++
    await nextTick()
    expect(assertion).toHaveBeenCalledTimes(2)
    expect(result).toBe(true)
  })

  it('watchPostEffect', async () => {
    const count = ref(0)
    let result
    const assertion = vi.fn(count => {
      result = serializeInner(root) === `${count}`
    })

    const Comp = {
      setup() {
        watchPostEffect(() => {
          assertion(count.value)
        })
        return () => count.value
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(assertion).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)

    count.value++
    await nextTick()
    expect(assertion).toHaveBeenCalledTimes(2)
    expect(result).toBe(true)
  })

  it('flush timing: sync', async () => {
    const count = ref(0)
    const count2 = ref(0)

    let callCount = 0
    let result1
    let result2
    const assertion = vi.fn(count => {
      callCount++
      // on mount, the watcher callback should be called before DOM render
      // on update, should be called before the count is updated
      const expectedDOM = callCount === 1 ? `` : `${count - 1}`
      result1 = serializeInner(root) === expectedDOM

      // in a sync callback, state mutation on the next line should not have
      // executed yet on the 2nd call, but will be on the 3rd call.
      const expectedState = callCount < 3 ? 0 : 1
      result2 = count2.value === expectedState
    })

    const Comp = {
      setup() {
        watchEffect(
          () => {
            assertion(count.value)
          },
          {
            flush: 'sync',
          },
        )
        return () => count.value
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(assertion).toHaveBeenCalledTimes(1)
    expect(result1).toBe(true)
    expect(result2).toBe(true)

    count.value++
    count2.value++
    await nextTick()
    expect(assertion).toHaveBeenCalledTimes(3)
    expect(result1).toBe(true)
    expect(result2).toBe(true)
  })

  it('watchSyncEffect', async () => {
    const count = ref(0)
    const count2 = ref(0)

    let callCount = 0
    let result1
    let result2
    const assertion = vi.fn(count => {
      callCount++
      // on mount, the watcher callback should be called before DOM render
      // on update, should be called before the count is updated
      const expectedDOM = callCount === 1 ? `` : `${count - 1}`
      result1 = serializeInner(root) === expectedDOM

      // in a sync callback, state mutation on the next line should not have
      // executed yet on the 2nd call, but will be on the 3rd call.
      const expectedState = callCount < 3 ? 0 : 1
      result2 = count2.value === expectedState
    })

    const Comp = {
      setup() {
        watchSyncEffect(() => {
          assertion(count.value)
        })
        return () => count.value
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(assertion).toHaveBeenCalledTimes(1)
    expect(result1).toBe(true)
    expect(result2).toBe(true)

    count.value++
    count2.value++
    await nextTick()
    expect(assertion).toHaveBeenCalledTimes(3)
    expect(result1).toBe(true)
    expect(result2).toBe(true)
  })

  it('should not fire on component unmount w/ flush: post', async () => {
    const toggle = ref(true)
    const cb = vi.fn()
    const Comp = {
      setup() {
        watch(toggle, cb, { flush: 'post' })
      },
      render() {},
    }
    const App = {
      render() {
        return toggle.value ? h(Comp) : null
      },
    }
    render(h(App), nodeOps.createElement('div'))
    expect(cb).not.toHaveBeenCalled()
    toggle.value = false
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })

  // #2291
  it('should not fire on component unmount w/ flush: pre', async () => {
    const toggle = ref(true)
    const cb = vi.fn()
    const Comp = {
      setup() {
        watch(toggle, cb, { flush: 'pre' })
      },
      render() {},
    }
    const App = {
      render() {
        return toggle.value ? h(Comp) : null
      },
    }
    render(h(App), nodeOps.createElement('div'))
    expect(cb).not.toHaveBeenCalled()
    toggle.value = false
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })

  // #7030
  it('should not fire on child component unmount w/ flush: pre', async () => {
    const visible = ref(true)
    const cb = vi.fn()
    const Parent = defineComponent({
      props: ['visible'],
      render() {
        return visible.value ? h(Comp) : null
      },
    })
    const Comp = {
      setup() {
        watch(visible, cb, { flush: 'pre' })
      },
      render() {},
    }
    const App = {
      render() {
        return h(Parent, {
          visible: visible.value,
        })
      },
    }
    render(h(App), nodeOps.createElement('div'))
    expect(cb).not.toHaveBeenCalled()
    visible.value = false
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })

  // #7030
  it('flush: pre watcher in child component should not fire before parent update', async () => {
    const b = ref(0)
    const calls: string[] = []

    const Comp = {
      setup() {
        watch(
          () => b.value,
          val => {
            calls.push('watcher child')
          },
          { flush: 'pre' },
        )
        return () => {
          b.value
          calls.push('render child')
        }
      },
    }

    const Parent = {
      props: ['a'],
      setup() {
        watch(
          () => b.value,
          val => {
            calls.push('watcher parent')
          },
          { flush: 'pre' },
        )
        return () => {
          b.value
          calls.push('render parent')
          return h(Comp)
        }
      },
    }

    const App = {
      render() {
        return h(Parent, {
          a: b.value,
        })
      },
    }

    render(h(App), nodeOps.createElement('div'))
    expect(calls).toEqual(['render parent', 'render child'])

    b.value++
    await nextTick()
    expect(calls).toEqual([
      'render parent',
      'render child',
      'watcher parent',
      'render parent',
      'watcher child',
      'render child',
    ])
  })

  // #1763
  it('flush: pre watcher watching props should fire before child update', async () => {
    const a = ref(0)
    const b = ref(0)
    const c = ref(0)
    const calls: string[] = []

    const Comp = {
      props: ['a', 'b'],
      setup(props: any) {
        watch(
          () => props.a + props.b,
          () => {
            calls.push('watcher 1')
            c.value++
          },
          { flush: 'pre' },
        )

        // #1777 chained pre-watcher
        watch(
          c,
          () => {
            calls.push('watcher 2')
          },
          { flush: 'pre' },
        )
        return () => {
          c.value
          calls.push('render')
        }
      },
    }

    const App = {
      render() {
        return h(Comp, { a: a.value, b: b.value })
      },
    }

    render(h(App), nodeOps.createElement('div'))
    expect(calls).toEqual(['render'])

    // both props are updated
    // should trigger pre-flush watcher first and only once
    // then trigger child render
    a.value++
    b.value++
    await nextTick()
    expect(calls).toEqual(['render', 'watcher 1', 'watcher 2', 'render'])
  })

  // #5721
  it('flush: pre triggered in component setup should be buffered and called before mounted', () => {
    const count = ref(0)
    const calls: string[] = []
    const App = {
      render() {},
      setup() {
        watch(
          count,
          () => {
            calls.push('watch ' + count.value)
          },
          { flush: 'pre' },
        )
        onMounted(() => {
          calls.push('mounted')
        })
        // mutate multiple times
        count.value++
        count.value++
        count.value++
      },
    }
    render(h(App), nodeOps.createElement('div'))
    expect(calls).toMatchObject(['watch 3', 'mounted'])
  })

  // #1852
  it('flush: post watcher should fire after template refs updated', async () => {
    const toggle = ref(false)
    let dom: TestElement | null = null

    const App = {
      setup() {
        const domRef = ref<TestElement | null>(null)

        watch(
          toggle,
          () => {
            dom = domRef.value
          },
          { flush: 'post' },
        )

        return () => {
          return toggle.value ? h('p', { ref: domRef }) : null
        }
      },
    }

    render(h(App), nodeOps.createElement('div'))
    expect(dom).toBe(null)

    toggle.value = true
    await nextTick()
    expect(dom!.tag).toBe('p')
  })

  it('deep', async () => {
    const state = reactive({
      nested: {
        count: ref(0),
      },
      array: [1, 2, 3],
      map: new Map([
        ['a', 1],
        ['b', 2],
      ]),
      set: new Set([1, 2, 3]),
    })

    let dummy
    watch(
      () => state,
      state => {
        dummy = [
          state.nested.count,
          state.array[0],
          state.map.get('a'),
          state.set.has(1),
        ]
      },
      { deep: true },
    )

    state.nested.count++
    await nextTick()
    expect(dummy).toEqual([1, 1, 1, true])

    // nested array mutation
    state.array[0] = 2
    await nextTick()
    expect(dummy).toEqual([1, 2, 1, true])

    // nested map mutation
    state.map.set('a', 2)
    await nextTick()
    expect(dummy).toEqual([1, 2, 2, true])

    // nested set mutation
    state.set.delete(1)
    await nextTick()
    expect(dummy).toEqual([1, 2, 2, false])
  })

  it('watching deep ref', async () => {
    const count = ref(0)
    const double = computed(() => count.value * 2)
    const state = reactive([count, double])

    let dummy
    watch(
      () => state,
      state => {
        dummy = [state[0].value, state[1].value]
      },
      { deep: true },
    )

    count.value++
    await nextTick()
    expect(dummy).toEqual([1, 2])
  })

  it('deep with symbols', async () => {
    const symbol1 = Symbol()
    const symbol2 = Symbol()
    const symbol3 = Symbol()
    const symbol4 = Symbol()

    const raw: any = {
      [symbol1]: {
        [symbol2]: 1,
      },
    }

    Object.defineProperty(raw, symbol3, {
      writable: true,
      enumerable: false,
      value: 1,
    })

    const state = reactive(raw)
    const spy = vi.fn()

    watch(() => state, spy, { deep: true })

    await nextTick()
    expect(spy).toHaveBeenCalledTimes(0)

    state[symbol1][symbol2] = 2
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)

    // Non-enumerable properties don't trigger deep watchers
    state[symbol3] = 3
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)

    // Adding a new symbol property
    state[symbol4] = 1
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(2)

    // Removing a symbol property
    delete state[symbol4]
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('immediate', async () => {
    const count = ref(0)
    const cb = vi.fn()
    watch(count, cb, { immediate: true })
    expect(cb).toHaveBeenCalledTimes(1)
    count.value++
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('immediate: triggers when initial value is null', async () => {
    const state = ref(null)
    const spy = vi.fn()
    watch(() => state.value, spy, { immediate: true })
    expect(spy).toHaveBeenCalled()
  })

  it('immediate: triggers when initial value is undefined', async () => {
    const state = ref()
    const spy = vi.fn()
    watch(() => state.value, spy, { immediate: true })
    expect(spy).toHaveBeenCalledWith(undefined, undefined, expect.any(Function))
    state.value = 3
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(2)
    // testing if undefined can trigger the watcher
    state.value = undefined
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(3)
    // it shouldn't trigger if the same value is set
    state.value = undefined
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('warn immediate option when using effect', async () => {
    const count = ref(0)
    let dummy
    watchEffect(
      () => {
        dummy = count.value
      },
      // @ts-expect-error
      { immediate: false },
    )
    expect(dummy).toBe(0)
    expect(`"immediate" option is only respected`).toHaveBeenWarned()

    count.value++
    await nextTick()
    expect(dummy).toBe(1)
  })

  it('warn and not respect deep option when using effect', async () => {
    const arr = ref([1, [2]])
    const spy = vi.fn()
    watchEffect(
      () => {
        spy()
        return arr
      },
      // @ts-expect-error
      { deep: true },
    )
    expect(spy).toHaveBeenCalledTimes(1)
    ;(arr.value[1] as Array<number>)[0] = 3
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(`"deep" option is only respected`).toHaveBeenWarned()
  })

  it('onTrack', async () => {
    const events: DebuggerEvent[] = []
    let dummy
    const onTrack = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive({ foo: 1, bar: 2 })
    watchEffect(
      () => {
        dummy = [obj.foo, 'bar' in obj, Object.keys(obj)]
      },
      { onTrack },
    )
    await nextTick()
    expect(dummy).toEqual([1, true, ['foo', 'bar']])
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

  it('onTrigger', async () => {
    const events: DebuggerEvent[] = []
    let dummy
    const onTrigger = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive<{ foo?: number }>({ foo: 1 })
    watchEffect(
      () => {
        dummy = obj.foo
      },
      { onTrigger },
    )
    await nextTick()
    expect(dummy).toBe(1)

    obj.foo!++
    await nextTick()
    expect(dummy).toBe(2)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(events[0]).toMatchObject({
      type: TriggerOpTypes.SET,
      key: 'foo',
      oldValue: 1,
      newValue: 2,
    })

    delete obj.foo
    await nextTick()
    expect(dummy).toBeUndefined()
    expect(onTrigger).toHaveBeenCalledTimes(2)
    expect(events[1]).toMatchObject({
      type: TriggerOpTypes.DELETE,
      key: 'foo',
      oldValue: 2,
    })
  })

  it('should work sync', () => {
    const v = ref(1)
    let calls = 0

    watch(
      v,
      () => {
        ++calls
      },
      {
        flush: 'sync',
      },
    )

    expect(calls).toBe(0)
    v.value++
    expect(calls).toBe(1)
  })

  test('should force trigger on triggerRef when watching a shallow ref', async () => {
    const v = shallowRef({ a: 1 })
    let sideEffect = 0
    watch(v, obj => {
      sideEffect = obj.a
    })

    v.value = v.value
    await nextTick()
    // should not trigger
    expect(sideEffect).toBe(0)

    v.value.a++
    await nextTick()
    // should not trigger
    expect(sideEffect).toBe(0)

    triggerRef(v)
    await nextTick()
    // should trigger now
    expect(sideEffect).toBe(2)
  })

  test('should force trigger on triggerRef when watching multiple sources: shallow ref array', async () => {
    const v = shallowRef([] as any)
    const spy = vi.fn()
    watch([v], () => {
      spy()
    })

    v.value.push(1)
    triggerRef(v)

    await nextTick()
    // should trigger now
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('should force trigger on triggerRef with toRef from reactive', async () => {
    const foo = reactive({ bar: 1 })
    const bar = toRef(foo, 'bar')
    const spy = vi.fn()

    watchEffect(() => {
      bar.value
      spy()
    })

    expect(spy).toHaveBeenCalledTimes(1)

    triggerRef(bar)

    await nextTick()
    // should trigger now
    expect(spy).toHaveBeenCalledTimes(2)
  })

  // #2125
  test('watchEffect should not recursively trigger itself', async () => {
    const spy = vi.fn()
    const price = ref(10)
    const history = ref<number[]>([])
    watchEffect(() => {
      history.value.push(price.value)
      spy()
    })
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // #2231
  test('computed refs should not trigger watch if value has no change', async () => {
    const spy = vi.fn()
    const source = ref(0)
    const price = computed(() => source.value === 0)
    watch(price, spy)
    source.value++
    await nextTick()
    source.value++
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // https://github.com/vuejs/core/issues/2381
  test('$watch should always register its effects with its own instance', async () => {
    let instance: ComponentInternalInstance | null
    let _show: Ref<boolean>

    const Child = defineComponent({
      render: () => h('div'),
      mounted() {
        instance = getCurrentInstance()
      },
      unmounted() {},
    })

    const Comp = defineComponent({
      setup() {
        const comp = ref<ComponentPublicInstance | undefined>()
        const show = ref(true)
        _show = show
        return { comp, show }
      },
      render() {
        return this.show
          ? h(Child, {
              ref: vm => void (this.comp = vm as ComponentPublicInstance),
            })
          : null
      },
      mounted() {
        // this call runs while Comp is currentInstance, but
        // the effect for this `$watch` should nonetheless be registered with Child
        this.comp!.$watch(
          () => this.show,
          () => void 0,
        )
      },
    })

    render(h(Comp), nodeOps.createElement('div'))

    expect(instance!).toBeDefined()
    expect(instance!.scope.effects).toBeInstanceOf(Array)
    // includes the component's own render effect AND the watcher effect
    expect(instance!.scope.effects.length).toBe(2)

    _show!.value = false

    await nextTick()
    await nextTick()

    expect(instance!.scope.effects.length).toBe(0)
  })

  test('this.$watch should pass `this.proxy` to watch source as the first argument ', () => {
    let instance: any
    const source = vi.fn()

    const Comp = defineComponent({
      render() {},
      created(this: any) {
        instance = this
        this.$watch(source, function () {})
      },
    })

    const root = nodeOps.createElement('div')
    createApp(Comp).mount(root)

    expect(instance).toBeDefined()
    expect(source.mock.calls.some(args => args.includes(instance)))
  })

  test('should not leak `this.proxy` to setup()', () => {
    const source = vi.fn()

    const Comp = defineComponent({
      render() {},
      setup() {
        watch(source, () => {})
      },
    })

    const root = nodeOps.createElement('div')
    createApp(Comp).mount(root)
    // should not have any arguments
    expect(source.mock.calls[0]).toMatchObject([])
  })

  // #2728
  test('pre watcher callbacks should not track dependencies', async () => {
    const a = ref(0)
    const b = ref(0)
    const updated = vi.fn()

    const Child = defineComponent({
      props: ['a'],
      updated,
      watch: {
        a() {
          b.value
        },
      },
      render() {
        return h('div', this.a)
      },
    })

    const Parent = defineComponent({
      render() {
        return h(Child, { a: a.value })
      },
    })

    const root = nodeOps.createElement('div')
    createApp(Parent).mount(root)

    a.value++
    await nextTick()
    expect(updated).toHaveBeenCalledTimes(1)

    b.value++
    await nextTick()
    // should not track b as dependency of Child
    expect(updated).toHaveBeenCalledTimes(1)
  })

  test('watching keypath', async () => {
    const spy = vi.fn()
    const Comp = defineComponent({
      render() {},
      data() {
        return {
          a: {
            b: 1,
          },
        }
      },
      watch: {
        'a.b': spy,
      },
      created(this: any) {
        this.$watch('a.b', spy)
      },
      mounted(this: any) {
        this.a.b++
      },
    })

    const root = nodeOps.createElement('div')
    createApp(Comp).mount(root)

    await nextTick()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('watching sources: ref<any[]>', async () => {
    const foo = ref([1])
    const spy = vi.fn()
    watch(foo, () => {
      spy()
    })
    foo.value = foo.value.slice()
    await nextTick()
    expect(spy).toBeCalledTimes(1)
  })

  it('watching multiple sources: computed', async () => {
    let count = 0
    const value = ref('1')
    const plus = computed(() => !!value.value)
    watch([plus], () => {
      count++
    })
    value.value = '2'
    await nextTick()
    expect(plus.value).toBe(true)
    expect(count).toBe(0)
  })

  // #4158
  test('watch should not register in owner component if created inside detached scope', () => {
    let instance: ComponentInternalInstance
    const Comp = {
      setup() {
        instance = getCurrentInstance()!
        effectScope(true).run(() => {
          watch(
            () => 1,
            () => {},
          )
        })
        return () => ''
      },
    }
    const root = nodeOps.createElement('div')
    createApp(Comp).mount(root)
    // should not record watcher in detached scope and only the instance's
    // own update effect
    expect(instance!.scope.effects.length).toBe(1)
  })

  test('watchEffect should keep running if created in a detached scope', async () => {
    const trigger = ref(0)
    let countWE = 0
    let countW = 0
    const Comp = {
      setup() {
        effectScope(true).run(() => {
          watchEffect(() => {
            trigger.value
            countWE++
          })
          watch(trigger, () => countW++)
        })
        return () => ''
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    // only watchEffect as ran so far
    expect(countWE).toBe(1)
    expect(countW).toBe(0)
    trigger.value++
    await nextTick()
    // both watchers run while component is mounted
    expect(countWE).toBe(2)
    expect(countW).toBe(1)
    render(null, root) // unmount
    await nextTick()
    trigger.value++
    await nextTick()
    // both watchers run again event though component has been unmounted
    expect(countWE).toBe(3)
    expect(countW).toBe(2)
  })

  const options = [
    { name: 'only trigger once watch' },
    {
      deep: true,
      name: 'only trigger once watch with deep',
    },
    {
      flush: 'sync',
      name: 'only trigger once watch with flush: sync',
    },
    {
      flush: 'pre',
      name: 'only trigger once watch with flush: pre',
    },
    {
      immediate: true,
      name: 'only trigger once watch with immediate',
    },
  ] as const
  test.each(options)('$name', async option => {
    const count = ref(0)
    const cb = vi.fn()

    watch(count, cb, { once: true, ...option })

    count.value++
    await nextTick()

    expect(count.value).toBe(1)
    expect(cb).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()

    expect(count.value).toBe(2)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  // #5151
  test('OnCleanup also needs to be cleaned，', async () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()
    const num = ref(0)

    watch(num, (value, oldValue, onCleanup) => {
      if (value > 1) {
        return
      }
      spy1()
      onCleanup(() => {
        // OnCleanup also needs to be cleaned
        spy2()
      })
    })

    num.value++
    await nextTick()
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(0)

    num.value++
    await nextTick()

    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)

    num.value++
    await nextTick()
    // would not be calld when value>1
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)
  })

  it('watching reactive depth', async () => {
    const state = reactive({
      a: {
        b: {
          c: {
            d: {
              e: 1,
            },
          },
        },
      },
    })

    const cb = vi.fn()

    watch(state, cb, { deep: 2 })

    state.a.b = { c: { d: { e: 2 } } }
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(1)

    state.a.b.c = { d: { e: 3 } }

    await nextTick()
    expect(cb).toHaveBeenCalledTimes(1)

    state.a.b = { c: { d: { e: 4 } } }

    await nextTick()
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('watching ref depth', async () => {
    const state = ref({
      a: {
        b: 2,
      },
    })

    const cb = vi.fn()

    watch(state, cb, { deep: 1 })

    state.value.a.b = 3
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(0)

    state.value.a = { b: 3 }
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('watching array depth', async () => {
    const arr = ref([
      {
        a: {
          b: 2,
        },
      },
      {
        a: {
          b: 3,
        },
      },
    ])
    const cb = vi.fn()
    watch(arr, cb, { deep: 2 })

    arr.value[0].a.b = 3
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(0)

    arr.value[0].a = { b: 3 }
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(1)

    arr.value[1].a = { b: 4 }
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(2)

    arr.value.push({ a: { b: 5 } })
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(3)

    arr.value.pop()
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(4)
  })

  test('pause / resume', async () => {
    const count = ref(0)
    const cb = vi.fn()
    const { pause, resume } = watch(count, cb)

    count.value++
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenLastCalledWith(1, 0, expect.any(Function))

    pause()
    count.value++
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenLastCalledWith(1, 0, expect.any(Function))

    resume()
    count.value++
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith(3, 1, expect.any(Function))

    count.value++
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(3)
    expect(cb).toHaveBeenLastCalledWith(4, 3, expect.any(Function))

    pause()
    count.value++
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(3)
    expect(cb).toHaveBeenLastCalledWith(4, 3, expect.any(Function))

    resume()
    await nextTick()
    expect(cb).toHaveBeenCalledTimes(4)
    expect(cb).toHaveBeenLastCalledWith(5, 4, expect.any(Function))
  })

  it('shallowReactive', async () => {
    const state = shallowReactive({
      msg: ref('hello'),
      foo: {
        a: ref(1),
        b: 2,
      },
      bar: 'bar',
    })

    const spy = vi.fn()

    watch(state, spy)

    state.msg.value = 'hi'
    await nextTick()
    expect(spy).not.toHaveBeenCalled()

    state.bar = 'bar2'
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)

    state.foo.a.value++
    state.foo.b++
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)

    state.bar = 'bar3'
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(2)
  })
  it('watching reactive with deep: false', async () => {
    const state = reactive({
      foo: {
        a: 2,
      },
      bar: 'bar',
    })

    const spy = vi.fn()

    watch(state, spy, { deep: false })

    state.foo.a++
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(0)

    state.bar = 'bar2'
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test("effect should be removed from scope's effects after it is stopped", () => {
    const num = ref(0)
    let unwatch: () => void

    let instance: ComponentInternalInstance
    const Comp = {
      setup() {
        instance = getCurrentInstance()!
        unwatch = watch(num, () => {
          console.log(num.value)
        })
        return () => null
      },
    }
    const root = nodeOps.createElement('div')
    createApp(Comp).mount(root)
    expect(instance!.scope.effects.length).toBe(2)
    unwatch!()
    expect(instance!.scope.effects.length).toBe(1)

    const scope = effectScope()
    scope.run(() => {
      unwatch = watch(num, () => {
        console.log(num.value)
      })
    })
    expect(scope.effects.length).toBe(1)
    unwatch!()
    expect(scope.effects.length).toBe(0)

    scope.run(() => {
      watch(num, () => {}, { once: true, immediate: true })
    })
    expect(scope.effects.length).toBe(0)
  })

  // simplified case of VueUse syncRef
  test('sync watcher should not be batched', () => {
    const a = ref(0)
    const b = ref(0)
    let pauseB = false
    watch(
      a,
      () => {
        pauseB = true
        b.value = a.value + 1
        pauseB = false
      },
      { flush: 'sync' },
    )
    watch(
      b,
      () => {
        if (!pauseB) {
          throw new Error('should not be called')
        }
      },
      { flush: 'sync' },
    )

    a.value = 1
    expect(b.value).toBe(2)
  })

  test('watchEffect should not fire on computed deps that did not change', async () => {
    const a = ref(0)
    const c = computed(() => a.value % 2)
    const spy = vi.fn()
    watchEffect(() => {
      spy()
      c.value
    })
    expect(spy).toHaveBeenCalledTimes(1)
    a.value += 2
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('circular reference', async () => {
    const obj = { a: 1 }
    // @ts-expect-error
    obj.b = obj
    const foo = ref(obj)
    const spy = vi.fn()

    watch(foo, spy, { deep: true })

    // @ts-expect-error
    foo.value.b.a = 2
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(foo.value.a).toBe(2)
  })

  test('watch immediate error in effect scope should be catched by onErrorCaptured', async () => {
    const warn = vi.spyOn(console, 'warn')
    warn.mockImplementation(() => {})
    const ERROR_IN_SCOPE = 'ERROR_IN_SCOPE'
    const ERROR_OUT_SCOPE = 'ERROR_OUT_SCOPE'

    const errors = ref<string[]>([])
    const Comp = {
      setup() {
        const trigger = ref(0)

        effectScope(true).run(() => {
          watch(
            trigger,
            () => {
              throw new Error(ERROR_IN_SCOPE)
            },
            { immediate: true },
          )
        })

        watchEffect(() => {
          throw new Error(ERROR_OUT_SCOPE)
        })

        return () => ''
      },
    }

    const root = nodeOps.createElement('div')
    render(
      h(
        {
          setup(_, { slots }) {
            onErrorCaptured(e => {
              errors.value.push(e.message)
              return false
            })

            return () => h('div', slots.default && slots.default())
          },
        },
        null,
        () => [h(Comp)],
      ),
      root,
    )
    await nextTick()
    // only watchEffect as ran so far
    expect(errors.value).toHaveLength(2)
    expect(errors.value[0]).toBe(ERROR_IN_SCOPE)
    expect(errors.value[1]).toBe(ERROR_OUT_SCOPE)

    warn.mockRestore()
  })

  test('should be executed correctly', () => {
    const v = ref(1)
    let foo = ''

    watch(
      v,
      () => {
        foo += '1'
      },
      {
        flush: 'sync',
      },
    )
    watch(
      v,
      () => {
        foo += '2'
      },
      {
        flush: 'sync',
      },
    )

    expect(foo).toBe('')
    v.value++
    expect(foo).toBe('12')
  })

  // 12045
  test('sync watcher should not break pre watchers', async () => {
    const count1 = ref(0)
    const count2 = ref(0)

    watch(
      count1,
      () => {
        count2.value++
      },
      { flush: 'sync' },
    )

    const spy1 = vi.fn()
    watch([count1, count2], spy1)

    const spy2 = vi.fn()
    watch(count1, spy2)

    count1.value++

    await nextTick()
    expect(spy1).toHaveBeenCalled()
    expect(spy2).toHaveBeenCalled()
  })
})
