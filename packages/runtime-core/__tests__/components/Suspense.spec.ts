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
  watchEffect,
  onUnmounted,
  onErrorCaptured,
  Component
} from '@vue/runtime-test'

describe('Suspense', () => {
  const deps: Promise<any>[] = []

  beforeEach(() => {
    deps.length = 0
  })

  // a simple async factory for testing purposes only.
  function defineAsyncComponent<T extends ComponentOptions>(
    comp: T,
    delay: number = 0
  ) {
    return {
      setup(props: any, { slots }: any) {
        const p = new Promise(resolve => {
          setTimeout(() => {
            resolve(() => h<Component>(comp, props, slots))
          }, delay)
        })
        // in Node 12, due to timer/nextTick mechanism change, we have to wait
        // an extra tick to avoid race conditions
        deps.push(p.then(() => Promise.resolve()))
        return p
      }
    }
  }

  test('fallback content', async () => {
    const Async = defineAsyncComponent({
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

    const AsyncOuter = defineAsyncComponent({
      setup() {
        onMounted(() => {
          calls.push('outer mounted')
        })
        return () => h(AsyncInner)
      }
    })

    const AsyncInner = defineAsyncComponent(
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
    expect(calls).toEqual([])

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    await Promise.all(deps)
    await nextTick()
    expect(calls).toEqual([`outer mounted`, `inner mounted`])
    expect(serializeInner(root)).toBe(`<div>inner</div>`)
  })

  test('onResolve', async () => {
    const Async = defineAsyncComponent({
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
        // extra tick needed for Node 12+
        deps.push(p.then(() => Promise.resolve()))

        watchEffect(() => {
          calls.push('immediate effect')
        })

        const count = ref(0)
        watch(count, v => {
          calls.push('watch callback')
        })
        count.value++ // trigger the watcher now

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
    expect(calls).toEqual([`immediate effect`])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
    expect(calls).toEqual([`immediate effect`, `watch callback`, `mounted`])

    // effects inside an already resolved suspense should happen at normal timing
    toggle.value = false
    await nextTick()
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    expect(calls).toEqual([
      `immediate effect`,
      `watch callback`,
      `mounted`,
      'unmounted'
    ])
  })

  // #1059
  test('mounted/updated hooks & fallback component', async () => {
    const deps: Promise<any>[] = []
    const calls: string[] = []
    const toggle = ref(true)

    const Async = {
      async setup() {
        const p = new Promise(r => setTimeout(r, 1))
        // extra tick needed for Node 12+
        deps.push(p.then(() => Promise.resolve()))

        await p
        return () => h('div', 'async')
      }
    }

    const Fallback = {
      setup() {
        onMounted(() => {
          calls.push('mounted')
        })

        onUnmounted(() => {
          calls.push('unmounted')
        })
        return () => h('div', 'fallback')
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: toggle.value ? h(Async) : null,
            fallback: h(Fallback)
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([`mounted`])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
    expect(calls).toEqual([`mounted`, `unmounted`])
  })

  test('content update before suspense resolve', async () => {
    const Async = defineAsyncComponent({
      props: { msg: String },
      setup(props: any) {
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

        watchEffect(() => {
          calls.push('immediate effect')
        })

        const count = ref(0)
        watch(count, () => {
          calls.push('watch callback')
        })
        count.value++ // trigger the watcher now

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
    expect(calls).toEqual(['immediate effect'])

    // remove the async dep before it's resolved
    toggle.value = false
    await nextTick()
    // should cause the suspense to resolve immediately
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    // should discard effects (except for immediate ones)
    expect(calls).toEqual(['immediate effect', 'watch callback', 'unmounted'])
  })

  test('unmount suspense after resolve', async () => {
    const toggle = ref(true)
    const unmounted = jest.fn()

    const Async = defineAsyncComponent({
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

    const Async = defineAsyncComponent({
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

    const AsyncOuter = defineAsyncComponent(
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

    const AsyncInner = defineAsyncComponent(
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
      `<div>async outer</div><div>fallback inner</div>`
    )
    expect(calls).toEqual([`outer mounted`])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div>async outer</div><div>async inner</div>`
    )
    expect(calls).toEqual([`outer mounted`, `inner mounted`])
  })

  test('nested suspense (child resolves first)', async () => {
    const calls: string[] = []

    const AsyncOuter = defineAsyncComponent(
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

    const AsyncInner = defineAsyncComponent(
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
      `<div>async outer</div><div>async inner</div>`
    )
    expect(calls).toEqual([`inner mounted`, `outer mounted`])
  })

  test('error handling', async () => {
    const Async = {
      async setup() {
        throw new Error('oops')
      }
    }

    const Comp = {
      setup() {
        const errorMessage = ref<string | null>(null)
        onErrorCaptured(err => {
          errorMessage.value =
            err instanceof Error
              ? err.message
              : `A non-Error value thrown: ${err}`
          return true
        })

        return () =>
          errorMessage.value
            ? h('div', errorMessage.value)
            : h(Suspense, null, {
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
    expect(serializeInner(root)).toBe(`<div>oops</div>`)
  })

  it('combined usage (nested async + nested suspense + multiple deps)', async () => {
    const msg = ref('nested msg')
    const calls: number[] = []

    const AsyncChildWithSuspense = defineAsyncComponent({
      props: { msg: String },
      setup(props: any) {
        onMounted(() => {
          calls.push(0)
        })
        return () =>
          h(Suspense, null, {
            default: h(AsyncInsideNestedSuspense, { msg: props.msg }),
            fallback: h('div', 'nested fallback')
          })
      }
    })

    const AsyncInsideNestedSuspense = defineAsyncComponent(
      {
        props: { msg: String },
        setup(props: any) {
          onMounted(() => {
            calls.push(2)
          })
          return () => h('div', props.msg)
        }
      },
      20
    )

    const AsyncChildParent = defineAsyncComponent({
      props: { msg: String },
      setup(props: any) {
        onMounted(() => {
          calls.push(1)
        })
        return () => h(NestedAsyncChild, { msg: props.msg })
      }
    })

    const NestedAsyncChild = defineAsyncComponent(
      {
        props: { msg: String },
        setup(props: any) {
          onMounted(() => {
            calls.push(3)
          })
          return () => h('div', props.msg)
        }
      },
      10
    )

    const MiddleComponent = {
      setup() {
        return () =>
          h(AsyncChildWithSuspense, {
            msg: msg.value
          })
      }
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: [
              h(MiddleComponent),
              h(AsyncChildParent, {
                msg: 'root async'
              })
            ],
            fallback: h('div', 'root fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>root fallback</div>`)
    expect(calls).toEqual([])

    /**
     * <Root>
     *   <Suspense>
     *     <MiddleComponent>
     *       <AsyncChildWithSuspense> (0: resolves on macrotask)
     *         <Suspense>
     *           <AsyncInsideNestedSuspense> (2: resolves on macrotask + 20ms)
     *     <AsyncChildParent> (1: resolves on macrotask)
     *       <NestedAsyncChild> (3: resolves on macrotask + 10ms)
     */

    // both top level async deps resolved, but there is another nested dep
    // so should still be in fallback state
    await Promise.all([deps[0], deps[1]])
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>root fallback</div>`)
    expect(calls).toEqual([])

    // root suspense all deps resolved. should show root content now
    // with nested suspense showing fallback content
    await deps[3]
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div>nested fallback</div><div>root async</div>`
    )
    expect(calls).toEqual([0, 1, 3])

    // change state for the nested component before it resolves
    msg.value = 'nested changed'

    // all deps resolved, nested suspense should resolve now
    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div>nested changed</div><div>root async</div>`
    )
    expect(calls).toEqual([0, 1, 3, 2])

    // should update just fine after resolve
    msg.value = 'nested changed again'
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div>nested changed again</div><div>root async</div>`
    )
  })

  test('new async dep after resolve should cause suspense to restart', async () => {
    const toggle = ref(false)

    const ChildA = defineAsyncComponent({
      setup() {
        return () => h('div', 'Child A')
      }
    })

    const ChildB = defineAsyncComponent({
      setup() {
        return () => h('div', 'Child B')
      }
    })

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: [h(ChildA), toggle.value ? h(ChildB) : null],
            fallback: h('div', 'root fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>root fallback</div>`)

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>Child A</div><!---->`)

    toggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>root fallback</div>`)

    await deps[1]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>Child A</div><div>Child B</div>`)
  })

  test.todo('teleport inside suspense')
})
