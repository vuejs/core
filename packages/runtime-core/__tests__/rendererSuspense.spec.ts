import {
  h,
  ref,
  Suspense,
  ComponentOptions,
  render,
  nodeOps,
  serializeInner,
  nextTick,
  onMounted,
  watch,
  onUnmounted
} from '@vue/runtime-test'

describe('renderer: suspense', () => {
  const deps: Promise<any>[] = []

  beforeEach(() => {
    deps.length = 0
  })

  // a simple async factory for testing purposes only.
  function createAsyncComponent<T extends ComponentOptions>(
    comp: T,
    delay: number = 0
  ) {
    return {
      async setup(props: any, { slots }: any) {
        const p: Promise<T> = new Promise(r => setTimeout(() => r(comp), delay))
        deps.push(p)
        const Inner = await p
        return () => h(Inner, props, slots)
      }
    }
  }

  it('basic usage (nested + multiple deps)', async () => {
    const msg = ref('hello')

    const AsyncChild = createAsyncComponent({
      setup(props: { msg: string }) {
        return () => h('div', props.msg)
      }
    })

    const AsyncChild2 = createAsyncComponent(
      {
        setup(props: { msg: string }) {
          return () => h('div', props.msg)
        }
      },
      10
    )

    const Mid = {
      setup() {
        return () =>
          h(AsyncChild, {
            msg: msg.value
          })
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, [msg.value, h(Mid), h(AsyncChild2, { msg: 'child 2' })])
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<!---->hello<div>hello</div><div>child 2</div><!---->`
    )
  })

  test('fallback content', async () => {
    const Async = createAsyncComponent({
      render() {
        return h('div', 'async')
      }
    })

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(Async),
            fallback: h('div', 'fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
  })

  test('onResolve', async () => {
    const Async = createAsyncComponent({
      render() {
        return h('div', 'async')
      }
    })

    const onResolve = jest.fn()

    const Comp = {
      setup() {
        return () =>
          h(
            Suspense,
            {
              onResolve
            },
            {
              default: h(Async),
              fallback: h('div', 'fallback')
            }
          )
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(onResolve).not.toHaveBeenCalled()

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
    expect(onResolve).toHaveBeenCalled()
  })

  test('buffer mounted/updated hooks & watch callbacks', async () => {
    const deps: Promise<any>[] = []
    const calls: string[] = []
    const toggle = ref(true)

    const Async = {
      async setup() {
        const p = new Promise(r => setTimeout(r, 1))
        deps.push(p)

        watch(() => {
          calls.push('watch callback')
        })

        onMounted(() => {
          calls.push('mounted')
        })

        onUnmounted(() => {
          calls.push('unmounted')
        })

        await p
        return () => h('div', 'async')
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: toggle.value ? h(Async) : null,
            fallback: h('div', 'fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
    expect(calls).toEqual([`watch callback`, `mounted`])

    // effects inside an already resolved suspense should happen at normal timing
    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    expect(calls).toEqual([`watch callback`, `mounted`, 'unmounted'])
  })

  test('content update before suspense resolve', async () => {
    const Async = createAsyncComponent({
      setup(props: { msg: string }) {
        return () => h('div', props.msg)
      }
    })

    const msg = ref('foo')

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(Async, { msg: msg.value }),
            fallback: h('div', `fallback ${msg.value}`)
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback foo</div>`)

    // value changed before resolve
    msg.value = 'bar'
    await nextTick()
    // fallback content should be updated
    expect(serializeInner(root)).toBe(`<div>fallback bar</div>`)

    await Promise.all(deps)
    await nextTick()
    // async component should receive updated props/slots when resolved
    expect(serializeInner(root)).toBe(`<div>bar</div>`)
  })

  // mount/unmount hooks should not even fire
  test('unmount before suspense resolve', async () => {
    const deps: Promise<any>[] = []
    const calls: string[] = []
    const toggle = ref(true)

    const Async = {
      async setup() {
        const p = new Promise(r => setTimeout(r, 1))
        deps.push(p)

        watch(() => {
          calls.push('watch callback')
        })

        onMounted(() => {
          calls.push('mounted')
        })

        onUnmounted(() => {
          calls.push('unmounted')
        })

        await p
        return () => h('div', 'async')
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: toggle.value ? h(Async) : null,
            fallback: h('div', 'fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    // remvoe the async dep before it's resolved
    toggle.value = false
    await nextTick()
    // should cause the suspense to resolve immediately
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    // should discard effects
    expect(calls).toEqual([])
  })

  test('unmount suspense after resolve', () => {})

  test.todo('unmount suspense before resolve')

  test.todo('nested suspense')

  test.todo('new async dep after resolve should cause suspense to restart')

  test.todo('error handling')

  test.todo('portal inside suspense')
})
