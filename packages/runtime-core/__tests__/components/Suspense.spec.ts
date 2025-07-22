/**
 * @vitest-environment jsdom
 */

import {
  type ComponentOptions,
  Fragment,
  KeepAlive,
  Suspense,
  type SuspenseProps,
  createCommentVNode,
  h,
  nextTick,
  nodeOps,
  onErrorCaptured,
  onMounted,
  onUnmounted,
  ref,
  render,
  resolveDynamicComponent,
  serializeInner,
  shallowRef,
  watch,
  watchEffect,
} from '@vue/runtime-test'
import { computed, createApp, defineComponent, inject, provide } from 'vue'
import type { RawSlots } from 'packages/runtime-core/src/componentSlots'
import { resetSuspenseId } from '../../src/components/Suspense'

describe('Suspense', () => {
  const deps: Promise<any>[] = []

  beforeEach(() => {
    deps.length = 0
    resetSuspenseId()
  })

  // a simple async factory for testing purposes only.
  function defineAsyncComponent<T extends ComponentOptions>(
    comp: T,
    delay: number = 0,
  ) {
    return {
      setup(props: any, { slots }: any) {
        const p = new Promise(resolve => {
          setTimeout(() => {
            resolve(() => h(comp, props, slots))
          }, delay)
        })
        // in Node 12, due to timer/nextTick mechanism change, we have to wait
        // an extra tick to avoid race conditions
        deps.push(p.then(() => Promise.resolve()))
        return p
      },
    }
  }

  const RouterView = {
    setup(_: any, { slots }: any) {
      const route = inject('route') as any
      const depth = inject('depth', 0)
      provide('depth', depth + 1)
      return () => {
        const current = route.value[depth]
        return slots.default({ Component: current })[0]
      }
    },
  }

  test('fallback content', async () => {
    const Async = defineAsyncComponent({
      render() {
        return h('div', 'async')
      },
    })

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(Async),
            fallback: h('div', 'fallback'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
  })

  test('emits events', async () => {
    const Async = defineAsyncComponent({
      render() {
        return h('div', 'async')
      },
    })

    const onFallback = vi.fn()
    const onResolve = vi.fn()
    const onPending = vi.fn()

    const show = ref(true)
    const Comp = {
      setup() {
        return () =>
          h(
            Suspense,
            {
              onFallback,
              onResolve,
              onPending,
              // force displaying the fallback right away
              timeout: 0,
            },
            {
              default: () => (show.value ? h(Async) : null),
              fallback: h('div', 'fallback'),
            },
          )
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(onPending).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledTimes(0)

    await Promise.all(deps)
    await nextTick()
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(onPending).toHaveBeenCalledTimes(1)
    expect(onResolve).toHaveBeenCalledTimes(1)

    show.value = false
    await nextTick()
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(onPending).toHaveBeenCalledTimes(2)
    expect(onResolve).toHaveBeenCalledTimes(2)

    deps.length = 0
    show.value = true
    await nextTick()
    expect(onFallback).toHaveBeenCalledTimes(2)
    expect(onPending).toHaveBeenCalledTimes(3)
    expect(onResolve).toHaveBeenCalledTimes(2)

    await Promise.all(deps)
    await nextTick()
    expect(onFallback).toHaveBeenCalledTimes(2)
    expect(onPending).toHaveBeenCalledTimes(3)
    expect(onResolve).toHaveBeenCalledTimes(3)
  })

  test('nested async deps', async () => {
    const calls: string[] = []

    const AsyncOuter = defineAsyncComponent({
      setup() {
        onMounted(() => {
          calls.push('outer mounted')
        })
        return () => h(AsyncInner)
      },
    })

    const AsyncInner = defineAsyncComponent(
      {
        setup() {
          onMounted(() => {
            calls.push('inner mounted')
          })
          return () => h('div', 'inner')
        },
      },
      10,
    )

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(AsyncOuter),
            fallback: h('div', 'fallback'),
          })
      },
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
      },
    })

    const onResolve = vi.fn()

    const Comp = {
      setup() {
        return () =>
          h(
            Suspense,
            {
              onResolve,
            },
            {
              default: h(Async),
              fallback: h('div', 'fallback'),
            },
          )
      },
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

  test('buffer mounted/updated hooks & post flush watch callbacks', async () => {
    const deps: Promise<any>[] = []
    const calls: string[] = []
    const toggle = ref(true)

    const Async = {
      async setup() {
        const p = new Promise(r => setTimeout(r, 1))
        // extra tick needed for Node 12+
        deps.push(p.then(() => Promise.resolve()))

        watchEffect(
          () => {
            calls.push('watch effect')
          },
          { flush: 'post' },
        )

        const count = ref(0)
        watch(
          count,
          () => {
            calls.push('watch callback')
          },
          { flush: 'post' },
        )
        count.value++ // trigger the watcher now

        onMounted(() => {
          calls.push('mounted')
        })

        onUnmounted(() => {
          calls.push('unmounted')
        })

        await p
        return () => h('div', 'async')
      },
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: toggle.value ? h(Async) : null,
            fallback: h('div', 'fallback'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>async</div>`)
    expect(calls).toEqual([`watch effect`, `watch callback`, `mounted`])

    // effects inside an already resolved suspense should happen at normal timing
    toggle.value = false
    await nextTick()
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)
    expect(calls).toEqual([
      `watch effect`,
      `watch callback`,
      `mounted`,
      'unmounted',
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
      },
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
      },
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: toggle.value ? h(Async) : null,
            fallback: h(Fallback),
          })
      },
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
      },
    })

    const msg = ref('foo')

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(Async, { msg: msg.value }),
            fallback: h('div', `fallback ${msg.value}`),
          })
      },
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

        watchEffect(
          () => {
            calls.push('watch effect')
          },
          { flush: 'post' },
        )

        const count = ref(0)
        watch(
          count,
          () => {
            calls.push('watch callback')
          },
          { flush: 'post' },
        )
        count.value++ // trigger the watcher now

        onMounted(() => {
          calls.push('mounted')
        })

        onUnmounted(() => {
          calls.push('unmounted')
        })

        await p
        return () => h('div', 'async')
      },
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: toggle.value ? h(Async) : null,
            fallback: h('div', 'fallback'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    // remove the async dep before it's resolved
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
    const unmounted = vi.fn()

    const Async = defineAsyncComponent({
      setup() {
        onUnmounted(unmounted)
        return () => h('div', 'async')
      },
    })

    const Comp = {
      setup() {
        return () =>
          toggle.value
            ? h(Suspense, null, {
                default: h(Async),
                fallback: h('div', 'fallback'),
              })
            : null
      },
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
    const mounted = vi.fn()
    const unmounted = vi.fn()

    const Async = defineAsyncComponent({
      setup() {
        onMounted(mounted)
        onUnmounted(unmounted)
        return () => h('div', 'async')
      },
    })

    const Comp = {
      setup() {
        return () =>
          toggle.value
            ? h(Suspense, null, {
                default: h(Async),
                fallback: h('div', 'fallback'),
              })
            : null
      },
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

  // vuetifyjs/vuetify#15207
  test('update prop of async element before suspense resolve', async () => {
    let resolve: () => void
    const mounted = new Promise<void>(r => {
      resolve = r
    })
    const Async = {
      async setup() {
        onMounted(() => {
          resolve()
        })
        const p = new Promise(r => setTimeout(r, 1))
        await p
        return () => h('div', 'async')
      },
    }

    const Comp: ComponentOptions<{ data: string }> = {
      props: ['data'],
      setup(props) {
        return () => h(Async, { 'data-test': props.data })
      },
    }

    const Root = {
      setup() {
        const data = ref('1')
        onMounted(() => {
          data.value = '2'
        })
        return () =>
          h(Suspense, null, {
            default: h(Comp, { data: data.value }),
            fallback: h('div', 'fallback'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Root), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    await mounted
    expect(serializeInner(root)).toBe(`<div data-test="2">async</div>`)
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
        },
      },
      1,
    )

    const AsyncInner = defineAsyncComponent(
      {
        setup: () => {
          onMounted(() => {
            calls.push('inner mounted')
          })
          return () => h('div', 'async inner')
        },
      },
      10,
    )

    const Inner = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(AsyncInner),
            fallback: h('div', 'fallback inner'),
          })
      },
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h('div', [h(AsyncOuter), h(Inner)]),
            fallback: h('div', 'fallback outer'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback outer</div>`)

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>async outer</div><div>fallback inner</div></div>`,
    )
    expect(calls).toEqual([`outer mounted`])

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>async outer</div><div>async inner</div></div>`,
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
        },
      },
      10,
    )

    const AsyncInner = defineAsyncComponent(
      {
        setup: () => {
          onMounted(() => {
            calls.push('inner mounted')
          })
          return () => h('div', 'async inner')
        },
      },
      1,
    )

    const Inner = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(AsyncInner),
            fallback: h('div', 'fallback inner'),
          })
      },
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h('div', [h(AsyncOuter), h(Inner)]),
            fallback: h('div', 'fallback outer'),
          })
      },
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
      `<div><div>async outer</div><div>async inner</div></div>`,
    )
    expect(calls).toEqual([`inner mounted`, `outer mounted`])
  })

  test('error handling', async () => {
    const Async = {
      async setup() {
        throw new Error('oops')
      },
    }

    const Comp = {
      setup() {
        const errorMessage = ref<string | null>(null)
        onErrorCaptured(err => {
          errorMessage.value =
            err instanceof Error
              ? err.message
              : `A non-Error value thrown: ${err}`
          return false
        })

        return () =>
          errorMessage.value
            ? h('div', errorMessage.value)
            : h(Suspense, null, {
                default: h(Async),
                fallback: h('div', 'fallback'),
              })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>oops</div>`)
  })

  // #3857
  test('error handling w/ template optimization', async () => {
    const Async = {
      async setup() {
        throw new Error('oops')
      },
    }

    const Comp = {
      template: `
      <div v-if="errorMessage">{{ errorMessage }}</div>
      <Suspense v-else>
        <div>
          <Async />
        </div>
        <template #fallback>
          <div>fallback</div>
        </template>
      </Suspense>
      `,
      components: { Async },
      setup() {
        const errorMessage = ref<string | null>(null)
        onErrorCaptured(err => {
          errorMessage.value =
            err instanceof Error
              ? err.message
              : `A non-Error value thrown: ${err}`
          return false
        })
        return { errorMessage }
      },
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
            fallback: h('div', 'nested fallback'),
          })
      },
    })

    const AsyncInsideNestedSuspense = defineAsyncComponent(
      {
        props: { msg: String },
        setup(props: any) {
          onMounted(() => {
            calls.push(2)
          })
          return () => h('div', props.msg)
        },
      },
      20,
    )

    const AsyncChildParent = defineAsyncComponent({
      props: { msg: String },
      setup(props: any) {
        onMounted(() => {
          calls.push(1)
        })
        return () => h(NestedAsyncChild, { msg: props.msg })
      },
    })

    const NestedAsyncChild = defineAsyncComponent(
      {
        props: { msg: String },
        setup(props: any) {
          onMounted(() => {
            calls.push(3)
          })
          return () => h('div', props.msg)
        },
      },
      10,
    )

    const MiddleComponent = {
      setup() {
        return () =>
          h(AsyncChildWithSuspense, {
            msg: msg.value,
          })
      },
    }

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h('div', [
              h(MiddleComponent),
              h(AsyncChildParent, {
                msg: 'root async',
              }),
            ]),
            fallback: h('div', 'root fallback'),
          })
      },
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
      `<div><div>nested fallback</div><div>root async</div></div>`,
    )
    expect(calls).toEqual([0, 1, 3])

    // change state for the nested component before it resolves
    msg.value = 'nested changed'

    // all deps resolved, nested suspense should resolve now
    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>nested changed</div><div>root async</div></div>`,
    )
    expect(calls).toEqual([0, 1, 3, 2])

    // should update just fine after resolve
    msg.value = 'nested changed again'
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>nested changed again</div><div>root async</div></div>`,
    )
  })

  test('switching branches', async () => {
    const calls: string[] = []
    const toggle = ref(true)

    const Foo = defineAsyncComponent({
      setup() {
        onMounted(() => {
          calls.push('foo mounted')
        })
        onUnmounted(() => {
          calls.push('foo unmounted')
        })
        return () => h('div', ['foo', h(FooNested)])
      },
    })

    const FooNested = defineAsyncComponent(
      {
        setup() {
          onMounted(() => {
            calls.push('foo nested mounted')
          })
          onUnmounted(() => {
            calls.push('foo nested unmounted')
          })
          return () => h('div', 'foo nested')
        },
      },
      10,
    )

    const Bar = defineAsyncComponent(
      {
        setup() {
          onMounted(() => {
            calls.push('bar mounted')
          })
          onUnmounted(() => {
            calls.push('bar unmounted')
          })
          return () => h('div', 'bar')
        },
      },
      10,
    )

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: toggle.value ? h(Foo) : h(Bar),
            fallback: h('div', 'fallback'),
          })
      },
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
    expect(calls).toEqual([`foo mounted`, `foo nested mounted`])
    expect(serializeInner(root)).toBe(`<div>foo<div>foo nested</div></div>`)

    // toggle
    toggle.value = false
    await nextTick()
    expect(deps.length).toBe(3)
    // should remain on current view
    expect(calls).toEqual([`foo mounted`, `foo nested mounted`])
    expect(serializeInner(root)).toBe(`<div>foo<div>foo nested</div></div>`)

    await Promise.all(deps)
    await nextTick()
    const tempCalls = [
      `foo mounted`,
      `foo nested mounted`,
      `bar mounted`,
      `foo nested unmounted`,
      `foo unmounted`,
    ]
    expect(calls).toEqual(tempCalls)
    expect(serializeInner(root)).toBe(`<div>bar</div>`)

    // toggle back
    toggle.value = true
    await nextTick()
    // should remain
    expect(calls).toEqual(tempCalls)
    expect(serializeInner(root)).toBe(`<div>bar</div>`)

    await deps[3]
    await nextTick()
    // still pending...
    expect(calls).toEqual(tempCalls)
    expect(serializeInner(root)).toBe(`<div>bar</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(calls).toEqual([
      ...tempCalls,
      `foo mounted`,
      `foo nested mounted`,
      `bar unmounted`,
    ])
    expect(serializeInner(root)).toBe(`<div>foo<div>foo nested</div></div>`)
  })

  // #10098
  test('switching branches w/ nested suspense', async () => {
    const OuterB = defineAsyncComponent({
      setup: () => {
        return () =>
          h(RouterView, null, {
            default: ({ Component }: any) => [
              h(Suspense, null, {
                default: () => h(Component),
              }),
            ],
          })
      },
    })

    const InnerB = defineAsyncComponent({
      setup: () => {
        return () => h('div', 'innerB')
      },
    })

    const OuterA = defineAsyncComponent({
      setup: () => {
        return () =>
          h(RouterView, null, {
            default: ({ Component }: any) => [
              h(Suspense, null, {
                default: () => h(Component),
              }),
            ],
          })
      },
    })

    const InnerA = defineAsyncComponent({
      setup: () => {
        return () => h('div', 'innerA')
      },
    })

    const toggle = ref(true)
    const route = computed(() => {
      return toggle.value ? [OuterA, InnerA] : [OuterB, InnerB]
    })

    const Comp = {
      setup() {
        provide('route', route)
        return () =>
          h(RouterView, null, {
            default: ({ Component }: any) => [
              h(Suspense, null, {
                default: () => h(Component),
              }),
            ],
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>innerA</div>`)

    deps.length = 0

    toggle.value = false
    await nextTick()
    // toggle again
    toggle.value = true

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>innerA</div>`)
  })

  // #10415
  test('nested suspense (w/ suspensible) switch several times before parent suspense resolve', async () => {
    const OuterA = defineAsyncComponent({
      setup: () => {
        return () =>
          h(RouterView, null, {
            default: ({ Component }: any) => [
              h(Suspense, null, {
                default: () => h(Component),
              }),
            ],
          })
      },
    })

    const InnerA = defineAsyncComponent({
      setup: () => {
        return () => h('div', 'innerA')
      },
    })

    const route = shallowRef([OuterA, InnerA])
    const InnerB = defineAsyncComponent(
      {
        setup: () => {
          return () => h('div', 'innerB')
        },
      },
      5,
    )

    const InnerB1 = defineAsyncComponent(
      {
        setup: () => {
          return () => h('div', 'innerB1')
        },
      },
      5,
    )

    const InnerB2 = defineAsyncComponent(
      {
        setup: () => {
          return () => h('div', 'innerB2')
        },
      },
      5,
    )

    const OuterB = defineAsyncComponent(
      {
        setup() {
          nextTick(async () => {
            await new Promise(resolve => setTimeout(resolve, 1))
            route.value = [OuterB, InnerB1]
          })

          nextTick(async () => {
            await new Promise(resolve => setTimeout(resolve, 1))
            route.value = [OuterB, InnerB2]
          })

          return () =>
            h(RouterView, null, {
              default: ({ Component }: any) => [
                h(
                  Suspense,
                  { suspensible: true },
                  {
                    default: () => h(Component),
                  },
                ),
              ],
            })
        },
      },
      5,
    )

    const Comp = {
      setup() {
        provide('route', route)
        return () =>
          h(RouterView, null, {
            default: ({ Component }: any) => [
              h(Suspense, null, {
                default: () => h(Component),
              }),
            ],
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>innerA</div>`)

    deps.length = 0

    route.value = [OuterB, InnerB]
    await nextTick()

    await Promise.all(deps)
    await Promise.all(deps)
    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>innerB2</div>`)
  })

  test('branch switch to 3rd branch before resolve', async () => {
    const calls: string[] = []

    const makeComp = (name: string, delay = 0) =>
      defineAsyncComponent(
        {
          setup() {
            onMounted(() => {
              calls.push(`${name} mounted`)
            })
            onUnmounted(() => {
              calls.push(`${name} unmounted`)
            })
            return () => h('div', [name])
          },
        },
        delay,
      )

    const One = makeComp('one')
    const Two = makeComp('two', 10)
    const Three = makeComp('three', 20)

    const view = shallowRef(One)

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(view.value),
            fallback: h('div', 'fallback'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    expect(calls).toEqual([`one mounted`])

    view.value = Two
    await nextTick()
    expect(deps.length).toBe(2)

    // switch before two resolves
    view.value = Three
    await nextTick()
    expect(deps.length).toBe(3)

    // dep for two resolves
    await deps[1]
    await nextTick()
    // should still be on view one
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    expect(calls).toEqual([`one mounted`])

    await deps[2]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>three</div>`)
    expect(calls).toEqual([`one mounted`, `three mounted`, `one unmounted`])
  })

  test('branch switch back before resolve', async () => {
    const calls: string[] = []

    const makeComp = (name: string, delay = 0) =>
      defineAsyncComponent(
        {
          setup() {
            onMounted(() => {
              calls.push(`${name} mounted`)
            })
            onUnmounted(() => {
              calls.push(`${name} unmounted`)
            })
            return () => h('div', [name])
          },
        },
        delay,
      )

    const One = makeComp('one')
    const Two = makeComp('two', 10)

    const view = shallowRef(One)

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(view.value),
            fallback: h('div', 'fallback'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    expect(calls).toEqual([`one mounted`])

    view.value = Two
    await nextTick()
    expect(deps.length).toBe(2)

    // switch back before two resolves
    view.value = One
    await nextTick()
    expect(deps.length).toBe(2)

    // dep for two resolves
    await deps[1]
    await nextTick()
    // should still be on view one
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    expect(calls).toEqual([`one mounted`])
  })

  test('branch switch timeout + fallback', async () => {
    const calls: string[] = []

    const makeComp = (name: string, delay = 0) =>
      defineAsyncComponent(
        {
          setup() {
            onMounted(() => {
              calls.push(`${name} mounted`)
            })
            onUnmounted(() => {
              calls.push(`${name} unmounted`)
            })
            return () => h('div', [name])
          },
        },
        delay,
      )

    const One = makeComp('one')
    const Two = makeComp('two', 20)

    const view = shallowRef(One)

    const Comp = {
      setup() {
        return () =>
          h(
            Suspense,
            {
              timeout: 10,
            },
            {
              default: h(view.value),
              fallback: h('div', 'fallback'),
            },
          )
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([])

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    expect(calls).toEqual([`one mounted`])

    view.value = Two
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>one</div>`)
    expect(calls).toEqual([`one mounted`])

    await new Promise(r => setTimeout(r, 10))
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>fallback</div>`)
    expect(calls).toEqual([`one mounted`, `one unmounted`])

    await deps[1]
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>two</div>`)
    expect(calls).toEqual([`one mounted`, `one unmounted`, `two mounted`])
  })

  test('mount the fallback content is in the correct position', async () => {
    const makeComp = (name: string, delay = 0) =>
      defineAsyncComponent(
        {
          setup() {
            return () => h('div', [name])
          },
        },
        delay,
      )

    const One = makeComp('one')
    const Two = makeComp('two', 20)

    const view = shallowRef(One)

    const Comp = {
      setup() {
        return () =>
          h('div', [
            h(
              Suspense,
              {
                timeout: 10,
              },
              {
                default: h(view.value),
                fallback: h('div', 'fallback'),
              },
            ),
            h('div', 'three'),
          ])
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(
      `<div><div>fallback</div><div>three</div></div>`,
    )

    await deps[0]
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>one</div><div>three</div></div>`,
    )

    view.value = Two
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>one</div><div>three</div></div>`,
    )

    await new Promise(r => setTimeout(r, 10))
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>fallback</div><div>three</div></div>`,
    )

    await deps[1]
    await nextTick()
    expect(serializeInner(root)).toBe(
      `<div><div>two</div><div>three</div></div>`,
    )
  })

  // #2214
  // Since suspense renders its own root like a component, it should not patch
  // its content in optimized mode.
  test('should not miss nested element updates when used in templates', async () => {
    const n = ref(1)
    const Comp = {
      setup() {
        return { n }
      },
      template: `
      <Suspense>
        <div><span>{{ n }}</span></div>
      </Suspense>
      `,
    }
    const root = document.createElement('div')
    createApp(Comp).mount(root)
    expect(root.innerHTML).toBe(`<div><span>1</span></div>`)

    n.value++
    await nextTick()
    expect(root.innerHTML).toBe(`<div><span>2</span></div>`)
  })

  // #2215
  test('toggling nested async setup component inside already resolved suspense', async () => {
    const toggle = ref(false)
    const Child = {
      async setup() {
        return () => h('div', 'child')
      },
    }
    const Parent = () => h('div', ['parent', toggle.value ? h(Child) : null])
    const Comp = {
      setup() {
        return () => h(Suspense, () => h(Parent))
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>parent<!----></div>`)

    toggle.value = true
    // wait for flush
    await nextTick()
    // wait for child async setup resolve
    await nextTick()
    // child should be rendered now instead of stuck in limbo
    expect(serializeInner(root)).toBe(`<div>parent<div>child</div></div>`)

    toggle.value = false
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>parent<!----></div>`)
  })

  test('warn if using async setup when not in a Suspense boundary', () => {
    const Child = {
      name: 'Child',
      async setup() {
        return () => h('div', 'child')
      },
    }
    const Parent = {
      setup() {
        return () => h('div', [h(Child)])
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Parent), root)

    expect(
      `A component with async setup() must be nested in a <Suspense>`,
    ).toHaveBeenWarned()
  })

  test('nested suspense with suspensible', async () => {
    const calls: string[] = []
    let expected = ''

    const InnerA = defineAsyncComponent(
      {
        setup: () => {
          calls.push('innerA created')
          onMounted(() => {
            calls.push('innerA mounted')
          })
          return () => h('div', 'innerA')
        },
      },
      10,
    )

    const InnerB = defineAsyncComponent(
      {
        setup: () => {
          calls.push('innerB created')
          onMounted(() => {
            calls.push('innerB mounted')
          })
          return () => h('div', 'innerB')
        },
      },
      10,
    )

    const OuterA = defineAsyncComponent(
      {
        setup: (_, { slots }: any) => {
          calls.push('outerA created')
          onMounted(() => {
            calls.push('outerA mounted')
          })
          return () =>
            h(Fragment, null, [h('div', 'outerA'), slots.default?.()])
        },
      },
      5,
    )

    const OuterB = defineAsyncComponent(
      {
        setup: (_, { slots }: any) => {
          calls.push('outerB created')
          onMounted(() => {
            calls.push('outerB mounted')
          })
          return () =>
            h(Fragment, null, [h('div', 'outerB'), slots.default?.()])
        },
      },
      5,
    )

    const outerToggle = ref(false)
    const innerToggle = ref(false)

    /**
     *  <Suspense>
     *    <component :is="outerToggle ? outerB : outerA">
     *      <Suspense suspensible>
     *        <component :is="innerToggle ? innerB : innerA" />
     *      </Suspense>
     *    </component>
     *  </Suspense>
     */
    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: [
              h(outerToggle.value ? OuterB : OuterA, null, {
                default: () =>
                  h(
                    Suspense,
                    { suspensible: true },
                    {
                      default: h(innerToggle.value ? InnerB : InnerA),
                    },
                  ),
              }),
            ],
            fallback: h('div', 'fallback outer'),
          })
      },
    }

    expected = `<div>fallback outer</div>`
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(expected)

    // mount outer component
    await Promise.all(deps)
    await nextTick()

    expect(serializeInner(root)).toBe(expected)
    expect(calls).toEqual([`outerA created`])

    // mount inner component
    await Promise.all(deps)
    await nextTick()
    expected = `<div>outerA</div><div>innerA</div>`
    expect(serializeInner(root)).toBe(expected)

    expect(calls).toEqual([
      'outerA created',
      'innerA created',
      'outerA mounted',
      'innerA mounted',
    ])

    // toggle outer component
    calls.length = 0
    deps.length = 0
    outerToggle.value = true
    await nextTick()

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(expected) // expect not change

    await Promise.all(deps)
    await nextTick()
    expected = `<div>outerB</div><div>innerA</div>`
    expect(serializeInner(root)).toBe(expected)
    expect(calls).toContain('outerB mounted')
    expect(calls).toContain('innerA mounted')

    // toggle inner component
    calls.length = 0
    deps.length = 0
    innerToggle.value = true
    await nextTick()
    expect(serializeInner(root)).toBe(expected) // expect not change

    await Promise.all(deps)
    await nextTick()
    expected = `<div>outerB</div><div>innerB</div>`
    expect(serializeInner(root)).toBe(expected)
    expect(calls).toContain('innerB mounted')
  })

  // #8206
  test('nested suspense with suspensible & no async deps', async () => {
    const calls: string[] = []
    let expected = ''

    const InnerA = defineComponent({
      setup: () => {
        calls.push('innerA created')
        onMounted(() => {
          calls.push('innerA mounted')
        })
        return () => h('div', 'innerA')
      },
    })

    const InnerB = defineComponent({
      setup: () => {
        calls.push('innerB created')
        onMounted(() => {
          calls.push('innerB mounted')
        })
        return () => h('div', 'innerB')
      },
    })

    const OuterA = defineComponent({
      setup: (_, { slots }: any) => {
        calls.push('outerA created')
        onMounted(() => {
          calls.push('outerA mounted')
        })
        return () => h(Fragment, null, [h('div', 'outerA'), slots.default?.()])
      },
    })

    const OuterB = defineComponent({
      setup: (_, { slots }: any) => {
        calls.push('outerB created')
        onMounted(() => {
          calls.push('outerB mounted')
        })
        return () => h(Fragment, null, [h('div', 'outerB'), slots.default?.()])
      },
    })

    const outerToggle = ref(false)
    const innerToggle = ref(false)

    /**
     *  <Suspense>
     *    <component :is="outerToggle ? outerB : outerA">
     *      <Suspense suspensible>
     *        <component :is="innerToggle ? innerB : innerA" />
     *      </Suspense>
     *    </component>
     *  </Suspense>
     */
    const Comp = defineComponent({
      setup() {
        return () =>
          h(Suspense, null, {
            default: [
              h(outerToggle.value ? OuterB : OuterA, null, {
                default: () =>
                  h(
                    Suspense,
                    { suspensible: true },
                    {
                      default: h(innerToggle.value ? InnerB : InnerA),
                    },
                  ),
              }),
            ],
            fallback: h('div', 'fallback outer'),
          })
      },
    })

    expected = `<div>outerA</div><div>innerA</div>`
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(expected)

    // mount outer component and inner component
    await Promise.all(deps)
    await nextTick()

    expect(serializeInner(root)).toBe(expected)
    expect(calls).toEqual([
      'outerA created',
      'innerA created',
      'innerA mounted',
      'outerA mounted',
    ])

    // toggle outer component
    calls.length = 0
    deps.length = 0
    outerToggle.value = true
    await nextTick()

    await Promise.all(deps)
    await nextTick()
    expected = `<div>outerB</div><div>innerA</div>`
    expect(serializeInner(root)).toBe(expected)
    expect(calls).toContain('outerB mounted')
    expect(calls).toContain('innerA mounted')

    // toggle inner component
    calls.length = 0
    deps.length = 0
    innerToggle.value = true
    await Promise.all(deps)
    await nextTick()
    expected = `<div>outerB</div><div>innerB</div>`
    expect(serializeInner(root)).toBe(expected)
  })

  //#8678
  test('nested suspense (child suspense update before parent suspense resolve)', async () => {
    const calls: string[] = []

    const InnerA = defineAsyncComponent(
      {
        setup: () => {
          calls.push('innerA created')
          onMounted(() => {
            calls.push('innerA mounted')
          })
          return () => h('div', 'innerA')
        },
      },
      10,
    )

    const InnerB = defineAsyncComponent(
      {
        setup: () => {
          calls.push('innerB created')
          onMounted(() => {
            calls.push('innerB mounted')
          })
          return () => h('div', 'innerB')
        },
      },
      10,
    )

    const OuterA = defineAsyncComponent(
      {
        setup: (_, { slots }: any) => {
          calls.push('outerA created')
          onMounted(() => {
            calls.push('outerA mounted')
          })
          return () =>
            h(Fragment, null, [h('div', 'outerA'), slots.default?.()])
        },
      },
      5,
    )

    const OuterB = defineAsyncComponent(
      {
        setup: (_, { slots }: any) => {
          calls.push('outerB created')
          onMounted(() => {
            calls.push('outerB mounted')
          })
          return () =>
            h(Fragment, null, [h('div', 'outerB'), slots.default?.()])
        },
      },
      5,
    )

    const outerToggle = ref(false)
    const innerToggle = ref(false)

    /**
     *  <Suspense>
     *    <component :is="outerToggle ? outerB : outerA">
     *      <Suspense>
     *        <component :is="innerToggle ? innerB : innerA" />
     *      </Suspense>
     *    </component>
     *  </Suspense>
     */
    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: [
              h(outerToggle.value ? OuterB : OuterA, null, {
                default: () =>
                  h(Suspense, null, {
                    default: h(innerToggle.value ? InnerB : InnerA),
                  }),
              }),
            ],
            fallback: h('div', 'fallback outer'),
          })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    expect(serializeInner(root)).toBe(`<div>fallback outer</div>`)

    // mount outer component
    await Promise.all(deps)
    await nextTick()

    expect(serializeInner(root)).toBe(`<div>outerA</div><!---->`)
    expect(calls).toEqual([`outerA created`, `outerA mounted`])

    // mount inner component
    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>outerA</div><div>innerA</div>`)

    expect(calls).toEqual([
      'outerA created',
      'outerA mounted',
      'innerA created',
      'innerA mounted',
    ])

    calls.length = 0
    deps.length = 0

    // toggle both outer and inner components
    outerToggle.value = true
    innerToggle.value = true
    await nextTick()

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>outerB</div><!---->`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>outerB</div><div>innerB</div>`)

    // innerB only mount once
    expect(calls).toEqual([
      'outerB created',
      'outerB mounted',
      'innerB created',
      'innerB mounted',
    ])
  })

  // #6416
  test('KeepAlive with Suspense', async () => {
    const Async = defineAsyncComponent({
      render() {
        return h('div', 'async')
      },
    })
    const Sync = {
      render() {
        return h('div', 'sync')
      },
    }
    const components = [Async, Sync]
    const viewRef = ref(0)
    const root = nodeOps.createElement('div')
    const App = {
      render() {
        return h(KeepAlive, null, {
          default: () => {
            return h(Suspense, null, {
              default: h(components[viewRef.value]),
              fallback: h('div', 'Loading-dynamic-components'),
            })
          },
        })
      },
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>Loading-dynamic-components</div>`)

    viewRef.value = 1
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>sync</div>`)

    viewRef.value = 0
    await nextTick()

    expect(serializeInner(root)).toBe('<div>sync</div>')

    await Promise.all(deps)
    await nextTick()
    // when async resolve,it should be <div>async</div>
    expect(serializeInner(root)).toBe('<div>async</div>')

    viewRef.value = 1
    await nextTick()
    // TypeError: Cannot read properties of null (reading 'parentNode')
    // This has been fixed
    expect(serializeInner(root)).toBe(`<div>sync</div>`)
  })

  // #10899 / #11427
  test('KeepAlive + Suspense switch before branch resolves', async () => {
    const Async1 = defineAsyncComponent({
      render() {
        return h('div', 'async1')
      },
    })
    const Async2 = defineAsyncComponent({
      render() {
        return h('div', 'async2')
      },
    })
    const components = [Async1, Async2]
    const viewRef = ref(0)
    const root = nodeOps.createElement('div')
    const App = {
      render() {
        return h(
          KeepAlive,
          {
            max: 1,
          },
          {
            default: () => {
              return h(Suspense, null, {
                default: h(components[viewRef.value]),
                fallback: h('div', 'loading'),
              })
            },
          },
        )
      },
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>loading</div>`)

    // switch to Async2 before Async1 resolves
    viewRef.value = 1
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>loading</div>`)

    await Promise.all(deps)
    await nextTick()
    expect(serializeInner(root)).toBe('<div>async2</div>')

    viewRef.value = 0
    await nextTick()
    await Promise.all(deps)
    expect(serializeInner(root)).toBe(`<div>async1</div>`)

    viewRef.value = 1
    await nextTick()
    await Promise.all(deps)
    expect(serializeInner(root)).toBe(`<div>async2</div>`)
  })

  test('KeepAlive + Suspense + comment slot', async () => {
    const toggle = ref(false)
    const Async = defineAsyncComponent({
      render() {
        return h('div', 'async1')
      },
    })
    const App = {
      render() {
        return h(KeepAlive, null, {
          default: () => {
            return h(Suspense, null, {
              default: toggle.value ? h(Async) : createCommentVNode('v-if'),
            })
          },
        })
      },
    }

    const root = nodeOps.createElement('div')
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<!--v-if-->`)

    toggle.value = true
    await nextTick()
    await Promise.all(deps)
    expect(serializeInner(root)).toBe(`<div>async1</div>`)
  })

  // #6416 follow up / #10017
  test('Suspense patched during HOC async component re-mount', async () => {
    const key = ref('k')
    const data = ref('data')

    const Async = defineAsyncComponent({
      render() {
        return h('div', 'async')
      },
    })

    const Comp = {
      render() {
        return h(Async, { key: key.value })
      },
    }

    const root = nodeOps.createElement('div')
    const App = {
      render() {
        return h(Suspense, null, {
          default: h(Comp, { k: key.value, data: data.value }),
        })
      },
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<!---->`)

    await Promise.all(deps)

    // async mounted, but key change causing a new async comp to be loaded
    key.value = 'k1'
    await nextTick()

    // patch the Suspense
    // should not throw error due to Suspense vnode.el being null
    data.value = 'data2'
    await Promise.all(deps)
  })

  describe('warnings', () => {
    // base function to check if a combination of slots warns or not
    function baseCheckWarn(
      shouldWarn: boolean,
      children: RawSlots,
      props: SuspenseProps | null = null,
    ) {
      const Comp = {
        setup() {
          return () => h(Suspense, props, children)
        },
      }

      const root = nodeOps.createElement('div')
      render(h(Comp), root)

      if (shouldWarn) {
        expect(`<Suspense> slots expect a single root node.`).toHaveBeenWarned()
      } else {
        expect(
          `<Suspense> slots expect a single root node.`,
        ).not.toHaveBeenWarned()
      }
    }

    // actual function that we use in tests
    const checkWarn = baseCheckWarn.bind(null, true)
    const checkNoWarn = baseCheckWarn.bind(null, false)

    test('does not warn on single child', async () => {
      checkNoWarn({
        default: h('div'),
        fallback: h('div'),
      })
    })

    test('does not warn on null', async () => {
      checkNoWarn({
        default: null,
        fallback: null,
      })
    })

    test('does not warn on <component :is="null" />', async () => {
      checkNoWarn({
        default: () => [resolveDynamicComponent(null)],
        fallback: () => null,
      })
    })

    test('does not warn on empty array', async () => {
      checkNoWarn({
        default: [],
        fallback: () => [],
      })
    })

    test('warns on multiple children in default', async () => {
      checkWarn({
        default: [h('div'), h('div')],
      })
    })

    test('warns on multiple children in fallback', async () => {
      checkWarn({
        default: h('div'),
        fallback: [h('div'), h('div')],
      })
    })
  })
})
