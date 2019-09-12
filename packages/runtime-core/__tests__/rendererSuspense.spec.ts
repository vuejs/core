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

  test('nested async deps', async () => {
    const calls: string[] = []

    const AsyncOuter = createAsyncComponent({
      setup() {
        onMounted(() => {
          calls.push('outer mounted')
        })
        return () => h(AsyncInner)
      }
    })

    const AsyncInner = createAsyncComponent(
      {
        setup() {
          onMounted(() => {
            calls.push('inner mounted')
          })
          return () => h('div', 'inner')
        }
      },
      10
    )

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(AsyncOuter),
            fallback: h('div', 'fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>inner</div>`)
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

  test('unmount suspense after resolve', async () => {
    const toggle = ref(true)
    const unmounted = jest.fn()

    const Async = createAsyncComponent({
      setup() {
        onUnmounted(unmounted)
        return () => h('div', 'async')
      }
    })

    const Comp = {
      setup() {
        return () =>
          toggle.value
            ? h(Suspense, null, {
                default: h(Async),
                fallback: h('div', 'fallback')
              })
            : null
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
    expect(unmounted).not.toHaveBeenCalled()

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    expect(unmounted).toHaveBeenCalled()
  })

  test('unmount suspense before resolve', async () => {
    const toggle = ref(true)
    const mounted = jest.fn()
    const unmounted = jest.fn()

    const Async = createAsyncComponent({
      setup() {
        onMounted(mounted)
        onUnmounted(unmounted)
        return () => h('div', 'async')
      }
    })

    const Comp = {
      setup() {
        return () =>
          toggle.value
            ? h(Suspense, null, {
                default: h(Async),
                fallback: h('div', 'fallback')
              })
            : null
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    expect(mounted).not.toHaveBeenCalled()
    expect(unmounted).not.toHaveBeenCalled()

    await Promise.all(deps)
    await nextTick()
    // should not resolve and cause unmount
    expect(mounted).not.toHaveBeenCalled()
    expect(unmounted).not.toHaveBeenCalled()
  })

  test('nested suspense (parent resolves first)', async () => {
    const calls: string[] = []

    const AsyncOuter = createAsyncComponent(
      {
        setup: () => {
          onMounted(() => {
            calls.push('outer mounted')
          })
          return () => h('div', 'async outer')
        }
      },
      1
    )

    const AsyncInner = createAsyncComponent(
      {
        setup: () => {
          onMounted(() => {
            calls.push('inner mounted')
          })
          return () => h('div', 'async inner')
        }
      },
      10
    )

    const Inner = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(AsyncInner),
            fallback: h('div', 'fallback inner')
          })
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: [h(AsyncOuter), h(Inner)],
            fallback: h('div', 'fallback outer')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback outer</div>`)

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<!----><div>async outer</div><div>fallback inner</div><!---->`
    )
    expect(calls).toEqual([`outer mounted`])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<!----><div>async outer</div><div>async inner</div><!---->`
    )
    expect(calls).toEqual([`outer mounted`, `inner mounted`])
  })

  test('nested suspense (child resolves first)', async () => {
    const calls: string[] = []

    const AsyncOuter = createAsyncComponent(
      {
        setup: () => {
          onMounted(() => {
            calls.push('outer mounted')
          })
          return () => h('div', 'async outer')
        }
      },
      10
    )

    const AsyncInner = createAsyncComponent(
      {
        setup: () => {
          onMounted(() => {
            calls.push('inner mounted')
          })
          return () => h('div', 'async inner')
        }
      },
      1
    )

    const Inner = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(AsyncInner),
            fallback: h('div', 'fallback inner')
          })
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: [h(AsyncOuter), h(Inner)],
            fallback: h('div', 'fallback outer')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback outer</div>`)

    await deps[1]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>fallback outer</div>`)
    expect(calls).toEqual([])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<!----><div>async outer</div><div>async inner</div><!---->`
    )
    expect(calls).toEqual([`inner mounted`, `outer mounted`])
  })

  test.todo('error handling')

  test.todo('new async dep after resolve should cause suspense to restart')

  test.todo('portal inside suspense')
})
