import {
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
  withDirectives,
} from '@vue/runtime-dom'
import { VueServerRenderer, compile, runtimeVapor } from '../_utils'
import { setIsHydratingEnabled } from '../../src/dom/hydration'
import {
  formatHtml,
  formatNodeList,
  setupHydrationTest,
  testWithVDOMApp,
  testWithVaporApp,
} from './_helpers'

setupHydrationTest()

describe('VDOM interop', () => {
  // Previous tests (e.g. createVaporSSRApp) leave isHydratingEnabled = true.
  beforeEach(() => {
    setIsHydratingEnabled(false)
  })

  test('hydrate VDOM -> Vapor component should invoke vnode and directive mount hooks in VDOM order', async () => {
    const calls: string[] = []
    const dir = {
      created: vi.fn(() => calls.push('directive created')),
      beforeMount: vi.fn(() => calls.push('directive beforeMount')),
      mounted: vi.fn(() => calls.push('directive mounted')),
    }
    const serverVaporChild = compile(
      `<template><div>child</div></template>`,
      ref({}),
      {},
      {
        vapor: true,
        ssr: true,
      },
    )
    const clientVaporChild = compile(
      `<template><div>child</div></template>`,
      ref({}),
      {},
      {
        vapor: true,
        ssr: false,
      },
    )
    const ServerApp = defineComponent({
      setup() {
        return () =>
          withDirectives(
            h(serverVaporChild as any, {
              onVnodeBeforeMount: () => calls.push('vnode beforeMount'),
              onVnodeMounted: () => calls.push('vnode mounted'),
            }),
            [[dir]],
          )
      },
    })
    const ClientApp = defineComponent({
      setup() {
        return () =>
          withDirectives(
            h(clientVaporChild as any, {
              onVnodeBeforeMount: () => calls.push('vnode beforeMount'),
              onVnodeMounted: () => calls.push('vnode mounted'),
            }),
            [[dir]],
          )
      },
    })

    const html = await VueServerRenderer.renderToString(createSSRApp(ServerApp))
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = html

    const app = createSSRApp(ClientApp)
    app.use(runtimeVapor.vaporInteropPlugin)
    app.mount(container)

    await nextTick()

    expect(calls).toEqual([
      'vnode beforeMount',
      'directive created',
      'directive beforeMount',
      'directive mounted',
      'vnode mounted',
    ])
  })

  test('basic render vapor component', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
      </template>`,
      {
        VaporChild: {
          code: `<template>{{ data }}</template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"true"`)

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"false"`)
  })

  test('nested components (VDOM -> Vapor -> VDOM)', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
      </template>`,
      {
        VaporChild: {
          code: `<template><components.VdomChild/></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template>{{ data }}</template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"true"`)

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`"false"`)
  })

  test('nested components (VDOM -> Vapor(multi-root) -> VDOM)', async () => {
    const data = ref('foo')
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
      </template>`,
      {
        // Vapor component with multiple root nodes, VDOM child as first element
        // This ensures hydration starts at <!--[--> and tests skipFragmentAnchor
        VaporChild: {
          code: `<template><components.VdomChild/><div>second</div></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template><span>{{ data }}</span></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>foo</span><div>second</div><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>bar</span><div>second</div><!--]-->
      "
    `,
    )
  })

  test('nested components (VDOM -> Vapor(multi-root) -> VDOM) with preceding sibling', async () => {
    const data = ref('foo')
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <p>before</p>
        <components.VaporChild/>
      </template>`,
      {
        VaporChild: {
          code: `<template><components.VdomChild/><div>second</div></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template><span>{{ data }}</span></template>`,
          vapor: false,
        },
      },
      data,
    )
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>before</p>
      <!--[--><span>foo</span><div>second</div><!--]-->
      <!--]-->
      "
    `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><p>before</p>
      <!--[--><span>bar</span><div>second</div><!--]-->
      <!--]-->
      "
    `,
    )
  })

  test('nested components (VDOM -> Vapor) should not duplicate', async () => {
    const { container } = await testWithVDOMApp(
      `<script setup>const components = _components;</script>
          <template>
            <components.VaporChild/>
          </template>`,
      {
        VaporChild: {
          code: `<script vapor>
                import { ref } from 'vue'
                const show = ref(true)
              </script>
              <template>
                <template v-if="show">
                  <div>1</div>
                  <div>2</div>
                </template>
              </template>`,
          vapor: true,
        },
      },
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>1</div><div>2</div><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
  })

  test('nested components (VDOM -> Vapor -> VDOM (with slot fallback))', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
      </template>`,
      {
        VaporChild: {
          code: `<template><components.VdomChild/></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template><slot><span>{{data}}</span></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>true</span><!--]-->
      "
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>false</span><!--]-->
      "
    `,
    )
  })

  test('nested components (VDOM -> Vapor(with slot content) -> VDOM)', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
          <template>
            <components.VaporChild/>
          </template>`,
      {
        VaporChild: {
          code: `<template>
            <components.VdomChild>
              <template #default>
                <span>{{data}} vapor fallback</span>
              </template>
            </components.VdomChild>
          </template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template><slot><span>vdom fallback</span></slot></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>true vapor fallback</span><!--]-->
      "
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>false vapor fallback</span><!--]-->
      "
    `,
    )
  })

  test('nested components (VDOM -> Vapor(with slot content) -> Vapor)', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
          <template>
            <components.VaporChild/>
          </template>`,
      {
        VaporChild: {
          code: `<template>
            <components.VaporChild2>
              <template #default>
                <span>{{data}} vapor fallback</span>
              </template>
            </components.VaporChild2>
          </template>`,
          vapor: true,
        },
        VaporChild2: {
          code: `<template><slot><span>vapor fallback2</span></slot></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>true vapor fallback</span><!--]-->
      "
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><span>false vapor fallback</span><!--]-->
      "
    `,
    )
  })

  test('vapor slot render vdom component', async () => {
    const data = ref(true)
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild>
          <components.VdomChild/>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><div><slot/></div></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template>{{ data }}</template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[-->true<!--]-->
      </div>"
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[-->false<!--]-->
      </div>"
    `,
    )
  })

  test('vapor slot render vdom component (multi-root slot content)', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild>
          <components.VdomChild/>
          <div>vapor content</div>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><div><slot/></div></template>`,
          vapor: true,
        },
        VdomChild: {
          code: `<script setup>const data = _data;</script>
            <template><span>{{ data }}</span></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[--><span>foo</span><div>vapor content</div><!--]-->
      </div>"
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[--><span>bar</span><div>vapor content</div><!--]-->
      </div>"
    `,
    )
  })

  test('vapor slot render vdom component (render function)', async () => {
    const data = ref(true)
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data; const components = _components;
        const VdomChild = {
          setup() {
            return () => h('div', null, [h('div', [String(data.value)])])
          }
        }
      </script>
      <template>
        <components.VaporChild>
          <VdomChild/>
        </components.VaporChild>
      </template>`,
      {
        VaporChild: {
          code: `<template><div><slot/></div></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[--><div><div>true</div></div><!--]-->
      </div>"
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "<div>
      <!--[--><div><div>false</div></div><!--]-->
      </div>"
    `,
    )
  })

  test('hydrate VNode rendered via createDynamicComponent', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data; const components = _components;

        // Simulating RouterView pattern: VDOM component passes VNode through slot
        const RouterView = {
          setup(_, { slots }) {
            return () => {
              const component = h(components.VaporChild)
              return slots.default({ Component: component })
            }
          }
        }
      </script>
      <template>
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </template>`,
      {
        VaporChild: {
          code: `<template><div>{{ data }}</div></template>`,
          vapor: true,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>foo</div><!--dynamic-component--><!--]-->
      "
    `,
    )

    // The dynamic component's own anchor sits directly after its content and
    // before the enclosing slot's anchor, so a branch switch inserts inside
    // the slot range rather than after it.
    expect(formatNodeList(container.childNodes)).toEqual([
      '<!--[-->',
      '<div>foo</div>',
      'text("")',
      '<!--dynamic-component-->',
      'text("")',
      '<!--]-->',
    ])

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>bar</div><!--dynamic-component--><!--]-->
      "
    `,
    )
  })

  test('hydrate static VNode chunk rendered via createDynamicComponent', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        import { createStaticVNode } from 'vue'
        const data = _data
        const StaticChunk = createStaticVNode(
          '<div>first static</div><div>second static</div>',
          2,
        )
      </script>
      <template>
        <div>
          <component :is="StaticChunk" />
        </div>
        <span>{{ data }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div><div>first static</div><div>second static</div><!--dynamic-component--></div><span>foo</span><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div><div>first static</div><div>second static</div><!--dynamic-component--></div><span>bar</span><!--]-->
      "
    `,
    )
  })

  test('hydrate Fragment VNode rendered via createDynamicComponent', async () => {
    const data = ref('foo')
    const { container } = await testWithVaporApp(
      `<script setup>
        import { Fragment, h } from 'vue'
        const data = _data
        const FragmentChunk = h(Fragment, null, [
          h('div', null, 'first fragment'),
          h('div', null, 'second fragment'),
        ])
      </script>
      <template>
        <div>
          <component :is="FragmentChunk" />
        </div>
        <span>{{ data }}</span>
      </template>`,
      undefined,
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>
      <!--[--><div>first fragment</div><div>second fragment</div><!--]-->
      <!--dynamic-component--></div><span>foo</span><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>
      <!--[--><div>first fragment</div><div>second fragment</div><!--]-->
      <!--dynamic-component--></div><span>bar</span><!--]-->
      "
    `,
    )
  })

  test('hydrate vapor slot in vdom component with sibling nodes', async () => {
    const msg = ref('Hello World!')
    const { container } = await testWithVaporApp(
      `<script setup vapor>
        const msg = _data
        const components = _components
      </script>
      <template>
        <components.Comp>
          <h1>{{ msg }}</h1>
        </components.Comp>
        <h1>{{ msg }}</h1>
      </template>`,
      {
        Comp: {
          code: `
          <template>
            <div>
              <slot />
            </div>
          </template>`,
          vapor: false,
        },
      },
      msg,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>
      <!--[--><h1>Hello World!</h1><!--]-->
      </div><h1>Hello World!</h1><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    msg.value = 'Hi Vapor'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[--><div>
      <!--[--><h1>Hi Vapor</h1><!--]-->
      </div><h1>Hi Vapor</h1><!--]-->
      "
    `,
    )
  })

  test('hydrate dynamic vapor slot re-mount should stop stale effects from previous slot function', async () => {
    const staleState = reactive({ id: 0, text: 'zero' })
    const activeState = reactive({ id: 1, text: 'one' })
    const nextState = reactive({ id: 2, text: 'two' })
    const data = reactive({
      items: [staleState, activeState],
      track: vi.fn((_: number, text: string) => text),
    })

    const { container } = await testWithVaporApp(
      `<script setup vapor>
        const data = _data
        const components = _components
      </script>
      <template>
        <components.Comp>
          <template v-for="item in data.items" #default>
            <span>{{ data.track(item.id, item.text) }}</span>
          </template>
        </components.Comp>
      </template>`,
      {
        Comp: {
          code: `
          <template>
            <div>
              <slot />
            </div>
          </template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--[--><span>one</span><!--]-->
      </div>"
    `)

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.items.push(nextState)
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--[--><span>two</span><!--]-->
      </div>"
    `)

    data.track.mockClear()
    activeState.text = 'stale-one'
    await nextTick()

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "<div>
      <!--[--><span>two</span><!--]-->
      </div>"
    `)
    expect(data.track).not.toHaveBeenCalled()
  })

  test('hydrate multi-root VNode component via createDynamicComponent and switch branch', async () => {
    const data = ref({
      showMulti: true,
      tail: 'tail',
    })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { computed, h } from 'vue'
        const data = _data
        const components = _components
        const vnode = computed(() =>
          data.value.showMulti
            ? h(components.VdomMultiRoot)
            : h('p', null, 'fallback')
        )
      </script>
      <template>
        <component :is="vnode" />
        <span>{{ data.tail }}</span>
      </template>`,
      {
        VdomMultiRoot: {
          code: `<template><div>first</div><div>second</div></template>`,
          vapor: false,
        },
      },
      data,
    )

    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[--><div>first</div><div>second</div><!--]-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    expect(formatNodeList(container.childNodes)).toEqual([
      '<!--[-->',
      '<!--[-->',
      '<div>first</div>',
      '<div>second</div>',
      '<!--]-->',
      'text("")',
      '<!--dynamic-component-->',
      '<span>tail</span>',
      '<!--]-->',
    ])

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value.showMulti = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[--><!--]-->
      <p>fallback</p><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.showMulti = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[--><!--]-->
      <div>first</div><div>second</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[-->
      <!--[--><!--]-->
      <div>first</div><div>second</div><!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })
})
