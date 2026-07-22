import {
  KeepAlive,
  Suspense,
  createApp,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  onUpdated,
  reactive,
  ref,
} from '@vue/runtime-dom'
import {
  VaporKeepAlive,
  VaporTeleport,
  VaporTransitionGroup,
  createComponent,
  createDynamicComponent,
  createFor,
  createTemplateRefSetter,
  defineVaporComponent,
  renderEffect,
  template,
  vaporInteropPlugin,
} from '../../src'
import { VueServerRenderer, compile, runtimeDom, runtimeVapor } from '../_utils'

describe.todo('VaporSuspense', () => {})

describe('vdom interop', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  async function testSuspense(
    code: string,
    components: Record<string, { code: string; vapor: boolean }> = {},
    data: any = {},
    { vapor = false } = {},
  ) {
    const clientComponents: any = {}
    for (const key in components) {
      const comp = components[key]
      let code = comp.code
      const isVaporComp = !!comp.vapor
      clientComponents[key] = compile(code, data, clientComponents, {
        vapor: isVaporComp,
      })
    }

    const clientComp = compile(code, data, clientComponents, {
      vapor,
    })

    const app = (vapor ? runtimeVapor.createVaporApp : runtimeDom.createApp)(
      clientComp,
    )
    app.use(runtimeVapor.vaporInteropPlugin)

    const container = document.createElement('div')
    document.body.appendChild(container)
    app.mount(container)
    return { container }
  }

  function withAsyncScript(code: string) {
    return {
      code: `
    <script vapor>
      const data = _data; 
      const components = _components;
      const p = new Promise(r => setTimeout(r, 5))
      data.deps.push(p.then(() => Promise.resolve()))
      await p
    </script>
    ${code}
    `,
      vapor: true,
    }
  }

  test('vdom suspense: render vapor components', async () => {
    const data = { deps: [] }
    const { container } = await testSuspense(
      `<script setup>
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.VaporChild/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>hi</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)
    expect(data.deps.length).toBe(1)
    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>hi</div>`)
  })

  test('vdom suspense: nested async vapor components', async () => {
    const data = { deps: [] }
    const { container } = await testSuspense(
      `<script setup>
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.AsyncOuter/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        AsyncOuter: withAsyncScript(
          `<template><components.AsyncInner/></template>`,
        ),
        AsyncInner: withAsyncScript(`<template><div>inner</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    await data.deps[0]
    await nextTick()
    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>inner</div>`)
  })

  test('vdom suspense: content update before suspense resolve', async () => {
    const data = reactive({ msg: 'foo', deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.VaporChild/>
          <template #fallback>
            <span>fallback {{data.msg}}</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(
          `<template><div>{{data.msg}}</div></template>`,
        ),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback foo</span>`)

    data.msg = 'bar'
    await nextTick()
    expect(container.innerHTML).toBe(`<span>fallback bar</span>`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>bar</div>`)
  })

  test('vdom suspense: unmount before suspense resolve', async () => {
    const data = reactive({ show: true, deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense>
          <components.VaporChild v-if="data.show"/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>child</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    data.show = false
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
  })

  test('vdom suspense: unmount suspense after resolve', async () => {
    const data = reactive({ show: true, deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense v-if="data.show">
          <components.VaporChild/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>child</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<div>child</div>`)

    data.show = false
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
  })

  test('vdom suspense: unmount suspense before resolve', async () => {
    const data = reactive({ show: true, deps: [] })
    const { container } = await testSuspense(
      `<script setup>
        const data = _data;
        const components = _components;
      </script>
      <template>
        <Suspense v-if="data.show">
          <components.VaporChild/>
          <template #fallback>
            <span>fallback</span>
          </template>
        </Suspense>
      </template>`,
      {
        VaporChild: withAsyncScript(`<template><div>child</div></template>`),
      },
      data,
    )

    expect(container.innerHTML).toBe(`<span>fallback</span>`)

    data.show = false
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)

    await Promise.all(data.deps)
    await nextTick()
    expect(container.innerHTML).toBe(`<!--v-if-->`)
  })
})

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(r => (resolve = r))
  return { promise, resolve }
}

async function flushResolution(promise: Promise<void>) {
  await promise
  await Promise.resolve()
  await nextTick()
  await nextTick()
}

describe('effects in pending branches', () => {
  test('updated hook waits for the branch to resolve', async () => {
    const asyncSetup = deferred()
    const value = ref(0)
    const order: string[] = []
    const VaporChild = defineVaporComponent({
      setup() {
        const el = template('<div></div>')() as Element
        onMounted(() => order.push('mounted'))
        onUpdated(() => order.push('updated'))
        renderEffect(() => (el.textContent = String(value.value)))
        return el
      },
    })
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const Root = defineComponent({
      setup: () => () =>
        h(
          Suspense,
          { onResolve: () => order.push('resolved') },
          {
            default: () => h('div', [h(VaporChild as any), h(AsyncSibling)]),
            fallback: () => h('span', 'loading'),
          },
        ),
    })
    const host = document.createElement('div')
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    value.value++
    await nextTick()
    expect(order).toEqual([])

    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(order).toEqual(['resolved', 'mounted', 'updated'])
    app.unmount()
  })

  test('non-null template ref waits for the branch to resolve', async () => {
    const asyncSetup = deferred()
    const elementRef = ref<Element | null>(null)
    const VaporChild = defineVaporComponent({
      setup() {
        const el = template('<div>vapor</div>')() as Element
        createTemplateRefSetter()(el, elementRef)
        return el
      },
    })
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const Root = defineComponent({
      setup: () => () =>
        h(Suspense, null, {
          default: () => h('div', [h(VaporChild as any), h(AsyncSibling)]),
          fallback: () => h('span', 'loading'),
        }),
    })
    const host = document.createElement('div')
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    expect(elementRef.value).toBe(null)
    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(elementRef.value).toBeInstanceOf(HTMLDivElement)
    app.unmount()
  })

  test('slotted template ref uses the rendering suspense boundary', async () => {
    const asyncSetup = deferred()
    const elementRef = ref<Element | null>(null)
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const VDomHost = defineComponent({
      setup(_, { slots }) {
        return () =>
          h(Suspense, null, {
            default: () => h('div', [slots.default!(), h(AsyncSibling)]),
            fallback: () => h('span', 'loading'),
          })
      },
    })
    const VaporOwner = defineVaporComponent({
      setup() {
        const setRef = createTemplateRefSetter()
        return createComponent(VDomHost as any, null, {
          default: () => {
            const el = template('<div>slotted</div>')() as Element
            setRef(el, elementRef)
            return el
          },
        })
      },
    })
    const host = document.createElement('div')
    const app = createApp({ render: () => h(VaporOwner as any) })
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    expect(elementRef.value).toBe(null)
    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(elementRef.value).toBeInstanceOf(HTMLDivElement)
    app.unmount()
  })

  test('teleport target mount waits for the branch to resolve', async () => {
    const asyncSetup = deferred()
    const target = document.createElement('div')
    document.body.appendChild(target)
    const VaporChild = defineVaporComponent({
      setup() {
        return createComponent(
          VaporTeleport,
          { to: () => target },
          { default: () => template('<div>teleported</div>')() },
        )
      },
    })
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const Root = defineComponent({
      setup: () => () =>
        h(Suspense, null, {
          default: () => h('div', [h(VaporChild as any), h(AsyncSibling)]),
          fallback: () => h('span', 'loading'),
        }),
    })
    const host = document.createElement('div')
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    expect(target.textContent).toBe('')
    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(target.textContent).toBe('teleported')
    app.unmount()
    target.remove()
  })

  test('slotted teleport uses the rendering suspense boundary', async () => {
    const asyncSetup = deferred()
    const target = document.createElement('div')
    document.body.appendChild(target)
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const VDomHost = defineComponent({
      setup(_, { slots }) {
        return () =>
          h(Suspense, null, {
            default: () => h('div', [slots.default!(), h(AsyncSibling)]),
            fallback: () => h('span', 'loading'),
          })
      },
    })
    const VaporOwner = defineVaporComponent({
      setup() {
        return createComponent(VDomHost as any, null, {
          default: () =>
            createComponent(
              VaporTeleport,
              { to: () => target },
              { default: () => template('<div>teleported</div>')() },
            ),
        })
      },
    })
    const host = document.createElement('div')
    const app = createApp({ render: () => h(VaporOwner as any) })
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    expect(target.textContent).toBe('')
    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(target.textContent).toBe('teleported')
    app.unmount()
    target.remove()
  })

  test('unmounted hook waits when a child is removed from the pending branch', async () => {
    const asyncSetup = deferred()
    const show = ref(true)
    const order: string[] = []
    const VaporChild = defineVaporComponent({
      setup() {
        onMounted(() => order.push('mounted'))
        onUnmounted(() => order.push('unmounted'))
        return template('<div>vapor</div>')()
      },
    })
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const Root = defineComponent({
      setup: () => () =>
        h(
          Suspense,
          { onResolve: () => order.push('resolved') },
          {
            default: () =>
              h('div', [
                show.value ? h(VaporChild as any) : h('span', 'gone'),
                h(AsyncSibling),
              ]),
            fallback: () => h('span', 'loading'),
          },
        ),
    })
    const host = document.createElement('div')
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    show.value = false
    await nextTick()
    expect(order).toEqual([])

    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(order).toEqual(['resolved', 'unmounted'])
    app.unmount()
  })

  test.each(['vdom', 'vapor'] as const)(
    '%s unmounted hook runs when the whole pending boundary is removed',
    async kind => {
      const asyncSetup = deferred()
      const showBoundary = ref(true)
      const order: string[] = []
      const Child =
        kind === 'vdom'
          ? defineComponent({
              setup() {
                onUnmounted(() => order.push('unmounted'))
                return () => h('div', 'vdom')
              },
            })
          : defineVaporComponent({
              setup() {
                onUnmounted(() => order.push('unmounted'))
                return template('<div>vapor</div>')()
              },
            })
      const AsyncSibling = defineComponent({
        async setup() {
          await asyncSetup.promise
          return () => h('span', 'async')
        },
      })
      const Root = defineComponent({
        setup: () => () =>
          showBoundary.value
            ? h(Suspense, null, {
                default: () => h('div', [h(Child as any), h(AsyncSibling)]),
                fallback: () => h('span', 'loading'),
              })
            : h('span', 'gone'),
      })
      const host = document.createElement('div')
      const app = createApp(Root)
      app.use(vaporInteropPlugin)
      app.mount(host)

      await nextTick()
      showBoundary.value = false
      await nextTick()
      expect(order).toEqual(['unmounted'])
      app.unmount()
    },
  )

  test('keep-alive lifecycle and vnode hooks wait for the branch to resolve', async () => {
    const asyncSetup = deferred()
    const current = ref<'A' | 'B'>('A')
    const order: string[] = []
    const makeChild = (name: string) =>
      defineVaporComponent({
        name,
        setup() {
          onMounted(() => order.push(`${name} mounted`))
          onActivated(() => order.push(`${name} activated`))
          onDeactivated(() => order.push(`${name} deactivated`))
          return template(`<div>${name}</div>`)()
        },
      })
    const A = makeChild('A')
    const B = makeChild('B')
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const Root = defineComponent({
      setup: () => () => {
        const Child = current.value === 'A' ? A : B
        return h(
          Suspense,
          { onResolve: () => order.push('resolved') },
          {
            default: () =>
              h('div', [
                h(KeepAlive, null, {
                  default: () =>
                    h(Child as any, {
                      onVnodeMounted: () => order.push('vnode mounted'),
                      onVnodeUnmounted: () => order.push('vnode unmounted'),
                    }),
                }),
                h(AsyncSibling),
              ]),
            fallback: () => h('span', 'loading'),
          },
        )
      },
    })
    const host = document.createElement('div')
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    current.value = 'B'
    await nextTick()
    expect(order).toEqual([])

    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(order[0]).toBe('resolved')
    app.unmount()
  })

  test.each(['vdom', 'vapor'] as const)(
    '%s current keep-alive entry deactivates after the branch resolves',
    async kind => {
      const asyncSetup = deferred()
      const showKeepAlive = ref(true)
      const order: string[] = []
      const VDomChild = defineComponent({
        setup() {
          onDeactivated(() => order.push('deactivated'))
          return () => h('div', 'vdom')
        },
      })
      const VaporChild = defineVaporComponent({
        setup() {
          onDeactivated(() => order.push('deactivated'))
          return template('<div>vapor</div>')()
        },
      })
      const VaporTree = defineVaporComponent({
        setup() {
          return createComponent(VaporKeepAlive, null, {
            default: () => createDynamicComponent(() => VaporChild),
          })
        },
      })
      const AsyncSibling = defineComponent({
        async setup() {
          await asyncSetup.promise
          return () => h('span', 'async')
        },
      })
      const Root = defineComponent({
        setup: () => () =>
          h(Suspense, null, {
            default: () =>
              h('div', [
                showKeepAlive.value
                  ? kind === 'vdom'
                    ? h(KeepAlive, null, { default: () => h(VDomChild) })
                    : h(VaporTree as any)
                  : h('span', 'gone'),
                h(AsyncSibling),
              ]),
            fallback: () => h('span', 'loading'),
          }),
      })
      const host = document.createElement('div')
      const app = createApp(Root)
      app.use(vaporInteropPlugin)
      app.mount(host)

      await nextTick()
      showKeepAlive.value = false
      await nextTick()
      expect(order).toEqual([])

      asyncSetup.resolve()
      await flushResolution(asyncSetup.promise)
      expect(order).toEqual(['deactivated'])
      app.unmount()
    },
  )

  test('initial v-show appear enter waits for the branch to resolve', async () => {
    const asyncSetup = deferred()
    const calls: string[] = []
    const data = ref({
      show: true,
      onBeforeAppear: () => calls.push('before appear'),
      onAppear: () => calls.push('appear'),
    })
    const VaporChild = compile(
      `<template>
        <Transition
          appear
          :css="false"
          @before-appear="data.onBeforeAppear"
          @appear="data.onAppear"
        >
          <div v-show="data.show">vapor</div>
        </Transition>
      </template>`,
      data,
    )
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const Root = defineComponent({
      setup: () => () =>
        h(Suspense, null, {
          default: () => h('div', [h(VaporChild as any), h(AsyncSibling)]),
          fallback: () => h('span', 'loading'),
        }),
    })
    const host = document.createElement('div')
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    expect(calls).toEqual(['before appear'])
    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(calls).toEqual(['before appear', 'appear'])
    app.unmount()
  })

  test('transition-group move processing waits for the branch to resolve', async () => {
    const asyncSetup = deferred()
    const items = ref([1, 2])
    let first!: any
    const VaporChild = defineVaporComponent({
      setup() {
        const list = createFor(
          () => items.value,
          item => {
            const el = template('<div></div>')()
            el.textContent = String(item.value)
            return el
          },
          item => item,
        )
        first = (list.nodes as any)[0][0].nodes
        return createComponent(VaporTransitionGroup, null, {
          default: () => list,
        })
      },
    })
    const AsyncSibling = defineComponent({
      async setup() {
        await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const Root = defineComponent({
      setup: () => () =>
        h(Suspense, null, {
          default: () => h('div', [h(VaporChild as any), h(AsyncSibling)]),
          fallback: () => h('span', 'loading'),
        }),
    })
    const host = document.createElement('div')
    const app = createApp(Root)
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    items.value = [2, 1]
    await nextTick()
    expect(first.$transition.disabled).toBe(true)

    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(first.$transition.disabled).toBe(false)
    app.unmount()
  })

  test('hydrated transition appear enter waits for the branch to resolve', async () => {
    const asyncSetup = deferred()
    const calls: string[] = []
    const data = ref({
      onBeforeAppear: () => calls.push('before appear'),
      onAppear: () => calls.push('appear'),
    })
    const source = `<template>
      <Transition
        appear
        :css="false"
        @before-appear="data.onBeforeAppear"
        @appear="data.onAppear"
      >
        <div>vapor</div>
      </Transition>
    </template>`
    const ServerVaporChild = compile(source, data, {}, { ssr: true })
    const ClientVaporChild = compile(source, data)
    let isClient = false
    const AsyncSibling = defineComponent({
      async setup() {
        if (isClient) await asyncSetup.promise
        return () => h('span', 'async')
      },
    })
    const createRoot = (VaporChild: any) =>
      defineComponent({
        setup: () => () =>
          h(Suspense, null, {
            default: () => h('div', [h(VaporChild), h(AsyncSibling)]),
            fallback: () => h('span', 'loading'),
          }),
      })

    const html = await VueServerRenderer.renderToString(
      createSSRApp(createRoot(ServerVaporChild)),
    )
    const host = document.createElement('div')
    host.innerHTML = html
    isClient = true
    const app = createSSRApp(createRoot(ClientVaporChild))
    app.use(vaporInteropPlugin)
    app.mount(host)

    await nextTick()
    expect(calls).toEqual(['before appear'])
    asyncSetup.resolve()
    await flushResolution(asyncSetup.promise)
    expect(calls).toEqual(['before appear', 'appear'])
    app.unmount()
  })
})
