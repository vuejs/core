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
  testHydration,
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
      <!--[$--><span>foo</span><div>second</div><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[$--><span>bar</span><div>second</div><!--]-->
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
      <!--[$--><span>foo</span><div>second</div><!--]-->
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
      <!--[$--><span>bar</span><div>second</div><!--]-->
      <!--]-->
      "
    `,
    )
  })

  // the vdom parent finds the sibling by looking ahead past the vapor
  // component's range, not from what the component renders
  test('nested components (VDOM -> Vapor(multi-root) -> VDOM) with following sibling', async () => {
    const data = ref('foo')
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild/>
        <p>{{ data }}</p>
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
    const after = container.querySelector('p')
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[$--><span>foo</span><div>second</div><!--]-->
      <p>foo</p><!--]-->
      "
    `,
    )
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(container.querySelector('p')).toBe(after)
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[$--><span>bar</span><div>second</div><!--]-->
      <p>bar</p><!--]-->
      "
    `,
    )
  })

  // the vdom wrapper is the vapor app's sole root: the vapor child's range
  // at the cursor is handed through the wrapper to the vdom bridge
  test('nested components (Vapor -> VDOM -> Vapor(multi-root)) as sole roots', async () => {
    const data = ref('foo')
    const { container, html } = await testWithVaporApp(
      `<template><components.Host /></template>`,
      {
        Host: {
          code: `<script setup>const components = _components</script>
            <template><components.Child /></template>`,
          vapor: false,
        },
        Child: {
          code: `<template><p>one</p><b>{{ data }}</b></template>`,
          vapor: true,
        },
      },
      data,
    )
    const b = container.querySelector('b')
    expect(container.innerHTML).toBe(html)
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(container.querySelector('b')).toBe(b)
    expect(b!.textContent).toBe('bar')
  })

  test('raw VNode of a multi-root vapor component as the sole root', async () => {
    const data = ref('foo')
    const { container, html } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data
        const components = _components
        const vnode = h(components.Child)
      </script>
      <template><component :is="vnode" /></template>`,
      {
        D: `<template><p>d1</p><p>d2</p></template>`,
        Child: `<template><components.D /><b>{{ data }}</b></template>`,
      },
      data,
    )
    const b = container.querySelector('b')
    // the range is the vnode's component's: the dynamic component's anchor
    // goes after it
    expect(container.innerHTML).toBe(html + '<!--dynamic-component-->')
    expect(`Hydration node mismatch`).not.toHaveBeenWarned()
    expect(`Hydration children mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(container.querySelector('b')).toBe(b)
    expect(b!.textContent).toBe('bar')
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
      <!--[!--><span>true</span><!--]-->
      "
    `,
    )

    data.value = false
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[!--><span>false</span><!--]-->
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
      <!--[-->
      <!--[--><div>foo</div><!--dynamic-component--><!--]-->
      <!--]-->
      "
    `,
    )

    // The dynamic component's own anchor sits directly after its content and
    // before the enclosing slot's anchor, so a branch switch inserts inside
    // the slot range rather than after it.
    expect(formatNodeList(container.childNodes)).toEqual([
      '<!--[-->',
      '<!--[-->',
      '<div>foo</div>',
      'text("")',
      '<!--dynamic-component-->',
      '<!--]-->',
      '<!--]-->',
    ])

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[-->
      <!--[--><div>bar</div><!--dynamic-component--><!--]-->
      <!--]-->
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
      <!--[$--><div><div>first static</div><div>second static</div><!--dynamic-component--></div><span>foo</span><!--]-->
      "
    `,
    )

    expect(`Hydration node mismatch`).not.toHaveBeenWarned()

    data.value = 'bar'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[$--><div><div>first static</div><div>second static</div><!--dynamic-component--></div><span>bar</span><!--]-->
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
      <!--[$--><div>
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
      <!--[$--><div>
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
      <!--[$--><div>
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
      <!--[$--><div>
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
      <!--[$-->
      <!--[$--><div>first</div><div>second</div><!--]-->
      <!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    expect(formatNodeList(container.childNodes)).toEqual([
      '<!--[$-->',
      '<!--[$-->',
      'text("")',
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
      <!--[$-->
      <!--[$--><!--]-->
      <p>fallback</p><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.showMulti = true
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(
      `
      "
      <!--[$-->
      <!--[$--><!--]-->
      <div>first</div><div>second</div><!--dynamic-component--><span>tail</span><!--]-->
      "
    `,
    )

    data.value.tail = 'tail-updated'
    await nextTick()
    expect(formatHtml(container.innerHTML)).toMatchInlineSnapshot(`
      "
      <!--[$-->
      <!--[$--><!--]-->
      <div>first</div><div>second</div><!--dynamic-component--><span>tail-updated</span><!--]-->
      "
    `)
  })

  test('hydrate a functional child injecting from a vdom parent under vapor', async () => {
    const data = ref(0)
    const { container } = await testWithVaporApp(
      `<template><div><components.G :n="data" /></div></template>`,
      {
        G: {
          code: `<script setup>
            import { h, inject, provide } from 'vue'
            defineProps(['n'])
            provide('k', 'G')
            const F = props => h('i', inject('k', 'none') + ':' + props.n)
          </script>
          <template><F :n="n" /></template>`,
          vapor: false,
        },
      },
      data,
    )
    expect(formatHtml(container.innerHTML)).toBe('<div><i>G:0</i></div>')
    expect(`Hydration text content mismatch`).not.toHaveBeenWarned()

    data.value++
    await nextTick()
    expect(formatHtml(container.innerHTML)).toBe('<div><i>G:1</i></div>')
  })

  test('hydrate VDOM prop defaults injecting from a Vapor parent', async () => {
    const { container, html } = await testWithVaporApp(
      `<script setup vapor>
        import { provide } from 'vue'
        const components = _components
        provide('k', 'parent')
      </script>
      <template><components.Child /></template>`,
      {
        Child: {
          code: `<script setup>
            import { inject } from 'vue'
            defineProps({
              value: {
                default: () => inject('k', 'missing'),
              },
            })
          </script>
          <template><i>{{ value }}</i></template>`,
          vapor: false,
        },
      },
    )

    expect(html).toBe('<i>parent</i>')
    expect(container.innerHTML).toBe(html)
    expect('Hydration text content mismatch').not.toHaveBeenWarned()
  })

  test('hydrate vapor component root with css variables in style', async () => {
    const data = ref('red')
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <components.VaporChild :style="{ '--color': data }" />
      </template>`,
      {
        VaporChild: {
          code: `<template><div :style="{ '--size': '1px' }">child</div></template>`,
          vapor: true,
        },
      },
      data,
    )
    await nextTick()
    const el = container.firstElementChild as HTMLElement
    expect(el.style.getPropertyValue('--size')).toBe('1px')
    expect(el.style.getPropertyValue('--color')).toBe('red')

    data.value = 'blue'
    await nextTick()
    expect(el.style.getPropertyValue('--color')).toBe('blue')
  })

  test('hydrate vapor component root with css vars of vdom parent', async () => {
    const code = `<script setup>const data = _data; const components = _components;</script>
      <template><components.VaporChild /></template>
      <style>.a { color: v-bind(data) }</style>`
    const components = {
      VaporChild: {
        code: `<script setup>import { ref } from 'vue'; const p = ref('4px')</script>
          <template><div :style="{ padding: p }">child</div></template>`,
        vapor: true,
      },
    }
    const { container } = await testHydration(code, components, ref('red'), {
      isVaporApp: false,
      interop: true,
    })
    expect(container.innerHTML).toContain(':red;')
    expect(`Hydration style mismatch`).not.toHaveBeenWarned()

    // the vdom parent's css var differs between server and client
    await testHydration(code, components, ref('red'), {
      isVaporApp: false,
      interop: true,
      serverData: ref('blue'),
    })
    expect(`Hydration style mismatch`).toHaveBeenWarned()
  })

  test('updates a hydrated v-show VDOM root with an existing directive', async () => {
    const updated = vi.fn()
    const data = ref({ count: 0, show: true, updated })
    const { container, app } = await testWithVaporApp(
      `<template><components.Child v-show="data.show" /></template>`,
      {
        Child: {
          code: `<script setup>
            const data = _data
            const vCustom = { updated: () => data.value.updated() }
          </script>
          <template><div v-custom>{{ data.count }}</div></template>`,
          vapor: false,
        },
      },
      data,
    )
    try {
      expect(container.textContent).toBe('0')
      data.value.count++
      await nextTick()
      expect(container.textContent).toBe('1')
      expect(updated).toHaveBeenCalledTimes(1)

      data.value.show = false
      await nextTick()
      expect((container.firstElementChild as HTMLElement).style.display).toBe(
        'none',
      )
    } finally {
      app.unmount()
    }
  })

  test('preserves hydrated v-once roots when an interop child updates', async () => {
    const data = ref({ msg: 'one', show: true })
    const { container, app } = await testWithVaporApp(
      `<template><section><components.Child :msg="data.msg" v-show="data.show" /></section></template>`,
      {
        Child: {
          code: `<script setup>const props = defineProps(['msg'])</script>
          <template><div v-once>{{ props.msg }}</div></template>`,
          vapor: false,
        },
      },
      data,
    )
    try {
      expect(container.textContent).toBe('one')
      data.value.msg = 'two'
      await nextTick()
      expect(container.textContent).toBe('one')

      data.value.show = false
      await nextTick()
      expect(
        (container.querySelector('section > div') as HTMLElement).style.display,
      ).toBe('none')
    } finally {
      app.unmount()
    }
  })
})

// a vapor v-if chain renders its branch in a `<!--[i-->` range: a vdom parent
// steps over it, at the root of the vapor component and inside a fragment
describe('vapor v-if chain under a vdom parent', () => {
  const VaporChild = {
    code: `<template>
      <div v-if="data.a"><p>a</p></div>
      <div v-else><span>b</span></div>
    </template>`,
    vapor: true,
  }

  test.each([
    ['at the root of the vapor component', '<components.VaporChild />'],
    [
      'inside a vdom fragment',
      '<template v-for="i in 1"><components.VaporChild /><b>row</b></template>',
    ],
  ])('%s', async (_, child) => {
    const data = ref({ a: true })
    const { container } = await testWithVDOMApp(
      `<script setup>const data = _data; const components = _components;</script>
      <template>
        <div>
          ${child}
          <i>tail</i>
        </div>
      </template>`,
      { VaporChild },
      data,
    )
    const tail = container.querySelector('i')!
    expect(tail.textContent).toBe('tail')
    expect('Hydration').not.toHaveBeenWarned()

    data.value.a = false
    await nextTick()
    expect(container.querySelector('span')!.textContent).toBe('b')
    expect(container.querySelector('p')).toBeNull()
    expect(container.querySelector('i')).toBe(tail)
  })

  // a render function calling a vapor slot gets a vapor slot on the server
  // too, rendered through its ssr branch rather than the vnode fallback: the
  // branch range the chain checks is there
  test('in a vapor slot a vdom render function renders', async () => {
    const data = ref({ a: false, tail: 'T' })
    const { container } = await testWithVaporApp(
      `<script setup>
        import { h } from 'vue'
        const data = _data
        const Wrap = {
          setup(_, { slots }) {
            return () => h('section', null, slots.default())
          },
        }
      </script>
      <template>
        <Wrap>
          <div v-if="data.a"><p>a</p></div>
          <div v-else><span>b</span></div>
        </Wrap>
        <u>{{ data.tail }}</u>
      </template>`,
      {},
      data,
      ref({ a: true, tail: 'T' }),
    )
    expect(container.querySelector('section')!.innerHTML).toBe(
      '<!--[--><!--[0--><div><span>b</span></div><!--]--><!--]-->',
    )
    expect('Hydration node mismatch').toHaveBeenWarnedTimes(1)

    const u = container.querySelector('u')!
    data.value.tail = 'U'
    data.value.a = true
    await nextTick()
    expect(container.querySelector('u')).toBe(u)
    expect(u.textContent).toBe('U')
    expect(container.querySelector('section')!.innerHTML).toBe(
      '<!--[--><!--[0--><div><p>a</p></div><!--]--><!--]-->',
    )
  })

  // the server rendered a vapor multi-root component where the client renders
  // a vdom fragment of the same children: the fragment adopts the component's
  // range, as it adopted the `[` range of a multi-root component before
  test('a vdom fragment adopts the range of a vapor component with the same children', async () => {
    const appCode = `<script setup>const data = _data; const components = _components</script>
      <template>
        <div>
          <template v-if="data.flag"><b>A</b><b>B</b></template>
          <components.Pair v-else />
          <input />
        </div>
      </template>`
    const pairCode = `<template><b>A</b><b>B</b></template>`
    const serverData = ref({ flag: false })
    const html = await VueServerRenderer.renderToString(
      createSSRApp(
        compile(
          appCode,
          serverData,
          {
            Pair: compile(pairCode, serverData, {}, { vapor: true, ssr: true }),
          },
          { vapor: false, ssr: true },
        ),
      ),
    )
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const input = container.querySelector('input')!
    input.value = 'typed'

    const clientData = ref({ flag: true })
    createSSRApp(
      compile(
        appCode,
        clientData,
        { Pair: compile(pairCode, clientData, {}, { vapor: true }) },
        { vapor: false },
      ),
    )
      .use(runtimeVapor.vaporInteropPlugin)
      .mount(container)
    expect(container.querySelector('input')).toBe(input)
    expect(input.value).toBe('typed')
  })

  // the client renders more children than the server's vapor component:
  // recovery closes the adopted range with the component's own close
  test('a vdom fragment recovering inside the range of a vapor component keeps the vapor nodes after it', async () => {
    const data = reactive({ flag: true, id: 'a' })
    const { container } = await testWithVaporApp(
      `<template>
        <div>
          <components.Host />
          <components.Tail />
        </div>
      </template>`,
      {
        Host: {
          code: `<script setup>const data = _data; const components = _components</script>
            <template>
              <template v-if="data.flag"><b>A</b><b>B</b><b>C</b></template>
              <components.Pair v-else />
            </template>`,
          vapor: false,
        },
        Pair: `<template><b>A</b><b>B</b></template>`,
        Tail: `<template><input :id="data.id" /></template>`,
      },
      data,
      reactive({ flag: false, id: 'a' }),
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()
    expect(container.innerHTML).toBe(
      '<div><!--[$--><b>A</b><b>B</b><b>C</b><!--]--><input id="a"></div>',
    )

    const input = container.querySelector('input')!
    data.id = 'b'
    await nextTick()
    expect(container.querySelector('input')).toBe(input)
    expect(input.id).toBe('b')
  })
})

describe('interop root el', () => {
  const part = {
    code: `<template>
      <slot v-if="$slots.icon" name="icon" />
      <div v-else>Vapor part</div>
    </template>`,
    vapor: true,
  }
  const wrapper = {
    code: `<script setup>const components = _components</script>
      <template><components.Part /></template>`,
    vapor: false,
  }
  const appCode = `<script setup>
    const data = _data
    const components = _components
  </script><template><components.Wrapper :ref="data.capture" /></template>`

  for (const [mode, hydrate] of [
    ['VDOM', testWithVDOMApp],
    ['Vapor', testWithVaporApp],
  ] as const) {
    test.each([
      ['a vapor component', '<components.Part />'],
      ['Transition', '<Transition><components.Part /></Transition>'],
      ['KeepAlive', '<KeepAlive><components.Part /></KeepAlive>'],
      ['Suspense', '<Suspense><components.Part /></Suspense>'],
    ])(`wrapper whose root is %s (${mode} app)`, async (_, root) => {
      const capture = vi.fn()
      const { app, container, html } = await hydrate(
        appCode,
        {
          Part: part,
          Wrapper: {
            code: `<script setup>const components = _components</script>
              <template>${root}</template>`,
            vapor: false,
          },
        },
        ref({ capture }),
      )
      try {
        expect(html).toContain('<!--[1-->')
        expect(capture.mock.calls[0][0].$el).toBe(
          container.querySelector('div'),
        )
      } finally {
        app.unmount()
      }
    })

    test(`functional wrapper ref (${mode} app)`, async () => {
      const capture = vi.fn()
      const { app, container } = await hydrate(
        `<script setup>
          import { h } from 'vue'
          const data = _data
          const components = _components
          const Wrapper = (props, { slots }) => h(components.Part, props, slots)
        </script><template><Wrapper :ref="data.capture" /></template>`,
        { Part: part },
        ref({ capture }),
      )
      try {
        expect(capture).toHaveBeenCalledTimes(1)
        expect(capture.mock.calls[0][0]).toBe(container.querySelector('div'))
      } finally {
        app.unmount()
      }
    })

    // a component root opens no range of its own
    test(`component root (${mode} app)`, async () => {
      const capture = vi.fn()
      const { app, container, html } = await hydrate(
        appCode,
        {
          Leaf: `<template><div>Vapor part</div></template>`,
          Part: `<template><components.Leaf /></template>`,
          Wrapper: wrapper,
        },
        ref({ capture }),
      )
      try {
        expect(html).not.toContain('<!--[$-->')
        expect(capture.mock.calls[0][0].$el).toBe(
          container.querySelector('div'),
        )
      } finally {
        app.unmount()
      }
    })

    // the start node of the vapor component, as on mount
    test(`multi-root vapor root (${mode} app)`, async () => {
      const capture = vi.fn()
      const { app, container, html } = await hydrate(
        appCode,
        {
          Part: `<template><div>a</div><div>b</div></template>`,
          Wrapper: wrapper,
        },
        ref({ capture }),
      )
      try {
        expect(html).toContain('<!--[$-->')
        const vm = capture.mock.calls[0][0]
        expect(vm.$el).toBe(vm.$.subTree.el)
        expect(vm.$el).not.toBe(vm.$.subTree.anchor)
        expect(vm.$el.nextSibling).toBe(container.querySelector('div'))
      } finally {
        app.unmount()
      }
    })

    test.each([false, true])(
      `keyed v-for of wrapper with multi-root vapor root (${mode} app, update before prepend: %s)`,
      async updateFirst => {
        const data = ref({ rows: ['b'] })
        const { app, container } = await hydrate(
          `<script setup>const data = _data; const components = _components</script>
          <template><main><components.Wrapper v-for="id in data.rows" :key="id" :id="id" /></main></template>`,
          {
            Part: {
              code: `<script setup>
                import { ref } from 'vue'
                defineProps({ id: String })
                const n = ref(0)
              </script><template>
                <span @click="n++" :data-n="n">{{ id }}1</span>
                <span>{{ id }}2</span>
              </template>`,
              vapor: true,
            },
            Wrapper: {
              code: `<script setup>
                defineProps({ id: String })
                const components = _components
              </script><template><components.Part :id="id" /></template>`,
              vapor: false,
            },
          },
          data,
        )
        try {
          const main = container.querySelector('main')!
          expect(main.textContent).toBe('b1b2')
          if (updateFirst) {
            main.querySelector<HTMLElement>('span')!.click()
            await nextTick()
            expect(main.querySelector('span')!.getAttribute('data-n')).toBe('1')
          }
          data.value.rows = ['a', 'b']
          await nextTick()
          expect(main.textContent).toBe('a1a2b1b2')

          data.value.rows = ['b', 'a']
          await nextTick()
          expect(main.textContent).toBe('b1b2a1a2')

          data.value.rows = ['a']
          await nextTick()
          expect(main.textContent).toBe('a1a2')
        } finally {
          app.unmount()
        }
      },
    )

    test(`HOC chain (${mode} app)`, async () => {
      const capture = vi.fn()
      const middle = vi.fn()
      const inner = vi.fn()
      const { app, container } = await hydrate(
        appCode,
        {
          Part: part,
          Inner: wrapper,
          Middle: {
            code: `<script setup>const data = _data; const components = _components</script>
              <template><components.Inner :ref="data.inner" /></template>`,
            vapor: false,
          },
          Wrapper: {
            code: `<script setup>const data = _data; const components = _components</script>
              <template><components.Middle :ref="data.middle" /></template>`,
            vapor: false,
          },
        },
        ref({ capture, middle, inner }),
      )
      try {
        for (const spy of [capture, middle, inner]) {
          expect
            .soft(spy.mock.calls[0][0].$el)
            .toBe(container.querySelector('div'))
        }
      } finally {
        app.unmount()
      }
    })

    test(`lazy hydration updates ancestors (${mode} app)`, async () => {
      const capture = vi.fn()
      const inner = vi.fn()
      const strategy = vi.fn()
      const { app, container } = await hydrate(
        appCode,
        {
          Part: part,
          Inner: {
            code: `<script setup>
              import { defineAsyncComponent } from 'vue'
              const data = _data
              const components = _components
              const Lazy = defineAsyncComponent({
                loader: () => Promise.resolve(components.Part),
                hydrate: data.value.strategy,
              })
            </script><template><Lazy /></template>`,
            vapor: false,
          },
          Wrapper: {
            code: `<script setup>const data = _data; const components = _components</script>
              <template><components.Inner :ref="data.inner" /></template>`,
            vapor: false,
          },
        },
        ref({ capture, inner, strategy }),
      )
      try {
        await new Promise(r => setTimeout(r))
        const el = container.querySelector('div')!
        expect(strategy).toHaveBeenCalledTimes(1)
        expect(capture.mock.calls[0][0].$el.nodeType).toBe(8)
        strategy.mock.calls[0][0]()
        await nextTick()
        expect(container.querySelector('div')).toBe(el)
        expect.soft(capture.mock.calls[0][0].$el).toBe(el)
        expect.soft(inner.mock.calls[0][0].$el).toBe(el)
        expect(inner.mock.calls[0][0].$.subTree.el).toBe(el)
      } finally {
        app.unmount()
      }
    })

    test.each([false, true])(
      `async setup in Suspense updates ancestors (${mode} app, HOC: %s)`,
      async hoc => {
        const capture = vi.fn()
        const inner = vi.fn()
        let resolve!: () => void
        const data = ref({
          capture,
          inner,
          wait: new Promise<void>(r => {
            resolve = r
          }),
        })
        const { app, container } = await testHydration(
          appCode,
          {
            Part: {
              code: `<script setup>await _data.value.wait</script>${part.code}`,
              vapor: true,
            },
            Inner: {
              code: `<script setup>const components = _components</script>
              <template>${hoc ? '<components.Part />' : '<Suspense><components.Part /></Suspense>'}</template>`,
              vapor: false,
            },
            Wrapper: {
              code: `<script setup>const data = _data; const components = _components</script>
              <template>${hoc ? '<Suspense><components.Inner :ref="data.inner" /></Suspense>' : '<components.Inner :ref="data.inner" />'}</template>`,
              vapor: false,
            },
          },
          data,
          {
            isVaporApp: mode === 'Vapor',
            interop: true,
            serverData: ref({ ...data.value, wait: Promise.resolve() }),
          },
        )
        try {
          const el = container.querySelector('div')!
          expect(capture.mock.calls[0][0].$el.nodeType).toBe(8)
          resolve()
          await new Promise(r => setTimeout(r))
          await nextTick()
          const vm = inner.mock.calls[0][0]
          expect(container.querySelector('div')).toBe(el)
          expect.soft(capture.mock.calls[0][0].$el).toBe(el)
          expect.soft(vm.$el).toBe(el)
          const boundary = (hoc ? capture.mock.calls[0][0] : vm).$.subTree
          expect.soft(boundary.el).toBe(el)
          expect(boundary.suspense.activeBranch.el).toBe(el)
        } finally {
          app.unmount()
        }
      },
    )

    test.each([false, true])(
      `self update follows the root (${mode} app, Suspense: %s)`,
      async suspense => {
        const capture = vi.fn()
        const inner = vi.fn()
        const updated = vi.fn()
        const { app, container } = await hydrate(
          `<script setup>const data = _data; const components = _components</script>
          <template><main><components.Wrapper :ref="data.capture" /><i>tail</i></main></template>`,
          {
            Part: {
              code: `<script setup>
              import { ref } from 'vue'
              const show = ref(true)
            </script><template>
              <div v-if="show" @click="show = false">one</div>
              <span v-else @click="show = true">two</span>
            </template>`,
              vapor: true,
            },
            Inner: {
              code: `<script setup>
              import { onUpdated } from 'vue'
              const components = _components
              onUpdated(_data.value.updated)
            </script><template>${suspense ? '<Suspense><components.Part /></Suspense>' : '<components.Part />'}</template>`,
              vapor: false,
            },
            Wrapper: {
              code: `<script setup>
              import { onUpdated } from 'vue'
              const data = _data
              const components = _components
              onUpdated(data.value.updated)
            </script><template><components.Inner :ref="data.inner" /></template>`,
              vapor: false,
            },
          },
          ref({ capture, inner, updated }),
        )
        try {
          const main = container.querySelector('main')!
          const tail = container.querySelector('i')!
          const vm = inner.mock.calls[0][0]
          for (const [from, to] of [
            ['div', 'span'],
            ['span', 'div'],
          ]) {
            container.querySelector<HTMLElement>(from)!.click()
            await nextTick()
            const el = container.querySelector(to)!
            expect(el).not.toBeNull()
            expect.soft(capture.mock.calls[0][0].$el).toBe(el)
            expect.soft(vm.$el).toBe(el)
            expect.soft(vm.$.subTree.el).toBe(el)
            if (suspense)
              expect.soft(vm.$.subTree.suspense.activeBranch.el).toBe(el)
            expect(container.querySelector('main')).toBe(main)
            expect(container.querySelector('i')).toBe(tail)
          }
          expect(updated).not.toHaveBeenCalled()
        } finally {
          app.unmount()
        }
      },
    )

    test(`VDOM root guard (${mode} app)`, async () => {
      const capture = vi.fn()
      const { app, container } = await hydrate(
        appCode,
        {
          Part: {
            code: `<script setup>const data = _data</script>${part.code}`,
            vapor: false,
          },
          Wrapper: wrapper,
        },
        ref({ capture }),
      )
      try {
        expect(capture.mock.calls[0][0].$el).toBe(
          container.querySelector('div'),
        )
      } finally {
        app.unmount()
      }
    })

    test(`sync vapor root forwarding to async vapor child updates ancestors (${mode} app)`, async () => {
      const capture = vi.fn()
      let resolve!: () => void
      const data = ref({
        capture,
        wait: new Promise<void>(r => {
          resolve = r
        }),
      })
      const { app, container } = await testHydration(
        `<script setup>
          const data = _data
          const components = _components
        </script><template>
          <Suspense>
            <section>
              <components.Wrapper :ref="data.capture" />
            </section>
          </Suspense>
        </template>`,
        {
          Leaf: {
            code: `<script setup>await _data.value.wait</script>${part.code}`,
            vapor: true,
          },
          Part: {
            code: `<template><components.Leaf /></template>`,
            vapor: true,
          },
          Wrapper: wrapper,
        },
        data,
        {
          isVaporApp: mode === 'Vapor',
          interop: true,
          serverData: ref({ ...data.value, wait: Promise.resolve() }),
        },
      )
      try {
        const div = container.querySelector('section > div')!
        resolve()
        await new Promise(r => setTimeout(r))
        await nextTick()
        expect(capture.mock.calls[0][0].$el).toBe(div)
      } finally {
        app.unmount()
      }
    })

    test(`lazy hydration after a parent re-render (${mode} app)`, async () => {
      const capture = vi.fn()
      const inner = vi.fn()
      const strategy = vi.fn()
      const data = ref({ capture, inner, strategy, tick: 0 })
      const { app, container } = await hydrate(
        appCode,
        {
          Part: part,
          Inner: {
            code: `<script setup>
              import { defineAsyncComponent } from 'vue'
              const data = _data
              const components = _components
              const Lazy = defineAsyncComponent({
                loader: () => Promise.resolve(components.Part),
                hydrate: data.value.strategy,
              })
            </script><template><Lazy v-if="data.tick >= 0" /></template>`,
            vapor: false,
          },
          Wrapper: {
            code: `<script setup>const data = _data; const components = _components</script>
              <template><components.Inner :ref="data.inner" /></template>`,
            vapor: false,
          },
        },
        data,
      )
      try {
        await new Promise(r => setTimeout(r))
        const el = container.querySelector('div')!
        const vm = inner.mock.calls[0][0]
        expect(strategy).toHaveBeenCalledTimes(1)

        // Inner re-renders, Lazy gets a new vnode without updating
        data.value.tick++
        await nextTick()
        strategy.mock.calls[0][0]()
        await nextTick()
        expect.soft(vm.$el).toBe(el)
        expect.soft(vm.$.subTree.el).toBe(el)

        data.value.tick++
        await nextTick()
        expect(container.querySelector('div')).toBe(el)
        expect.soft(vm.$el).toBe(el)
        expect.soft(capture.mock.calls[0][0].$el).toBe(el)
      } finally {
        app.unmount()
      }
    })
  }
})

// vdom hydration replaces the node under the cursor: what located it, or
// holds it as the unit of a component, goes on with the new one
describe('vdom root replaced while hydrating', () => {
  const components = {
    Wrapper: `<template><components.Leaf /></template>`,
    Tail: `<template><b>tail</b></template>`,
  }

  test.each([
    ['in an element', `<components.Leaf />`],
    ['as the single root of a vapor component', `<components.Wrapper />`],
  ])('a mismatched root %s', async (_, first) => {
    const { container } = await testWithVaporApp(
      `<template>
        <main>
          ${first}
          <components.Tail />
        </main>
      </template>`,
      {
        ...components,
        Leaf: {
          code: `<script setup>const data = _data</script>
            <template>
              <i v-if="data">server</i>
              <span v-else>client</span>
            </template>`,
          vapor: false,
        },
      },
      ref(false),
      ref(true),
    )
    expect(container.innerHTML).toBe(
      `<main><span>client</span><b>tail</b></main>`,
    )
    expect(`Hydration node mismatch`).toHaveBeenWarned()
  })

  test.each([
    ['in an element', `<components.Leaf />`],
    ['as the single root of a vapor component', `<components.Wrapper />`],
  ])('an appearing Transition root %s', async (_, first) => {
    const { container } = await testWithVaporApp(
      `<template>
        <main>
          ${first}
          <components.Tail />
        </main>
      </template>`,
      {
        ...components,
        Leaf: {
          code: `<script setup>const data = _data</script>
            <template>
              <Transition appear :css="false"><i>root</i></Transition>
            </template>`,
          vapor: false,
        },
      },
    )
    expect(container.textContent).toBe('roottail')
    expect(container.querySelectorAll('b')).toHaveLength(1)
  })

  test.each([
    ['in an element', `<components.Leaf />`],
    ['as the single root of a vapor component', `<components.Wrapper />`],
  ])('a root replaced by a fragment %s', async (_, first) => {
    const data = ref({ server: false, tail: 'tail' })
    const { container } = await testWithVaporApp(
      `<template>
        <main>
          ${first}
          <components.Tail />
        </main>
      </template>`,
      {
        ...components,
        Tail: `<template><b>{{ data.tail }}</b></template>`,
        Leaf: {
          code: `<script setup>const data = _data</script>
            <template>
              <i v-if="data.server">server</i>
              <template v-else><b>one</b><b>two</b></template>
            </template>`,
          vapor: false,
        },
      },
      data,
      ref({ server: true, tail: 'tail' }),
    )
    expect(container.textContent).toBe('onetwotail')

    data.value.tail = 'updated'
    await nextTick()
    expect(container.textContent).toBe('onetwoupdated')
    expect(`Hydration node mismatch`).toHaveBeenWarned()
  })
})

// the boundary also holds for what the vdom renderer creates below it
describe('useId below a vapor component with onServerPrefetch', () => {
  const VaporItem = `<script setup vapor>
      import { useId } from 'vue'
      const id = useId()
    </script>
    <template>
      <p :id="id" />
    </template>`
  const VdomItem = {
    code: `<script setup>
        import { useId } from 'vue'
        const id = useId()
      </script>
      <template>
        <b :id="id" />
      </template>`,
    vapor: false,
  }
  const group = (content: string, setup = '') => `<script setup vapor>
      import { h, onServerPrefetch, useId } from 'vue'
      const components = _components
      onServerPrefetch(() => {})
      const id = useId()
      ${setup}
    </script>
    <template>
      <div :id="id">${content}</div>
    </template>`

  const ids = (root: ParentNode) =>
    [...root.querySelectorAll('[id]')].map(el => el.id)
  // the ids of the server: a different one warns of a mismatch
  const expected = ['v-0', 'v-0-0', 'v-0-1', 'v-1']

  test('vdom child', async () => {
    const { container } = await testWithVaporApp(
      `<template>
        <components.Group />
        <components.VaporItem />
      </template>`,
      {
        VaporItem,
        VdomItem,
        Group: group(`<components.VdomItem /><components.VaporItem />`),
      },
    )
    expect(ids(container)).toEqual(expected)
  })

  test('vdom slot content', async () => {
    const { container } = await testWithVDOMApp(
      `<script setup>const components = _components</script>
      <template>
        <components.Group>
          <components.VdomItem />
          <components.VdomItem />
        </components.Group>
        <components.VdomItem />
      </template>`,
      { VdomItem, Group: group(`<slot />`) },
    )
    expect(ids(container)).toEqual(expected)
  })

  test('vnode through a dynamic component', async () => {
    const { container } = await testWithVaporApp(
      `<template>
        <components.Group />
        <components.VaporItem />
      </template>`,
      {
        VaporItem,
        VdomItem,
        Group: group(
          `<component :is="vnode" /><components.VaporItem />`,
          `const vnode = h(components.VdomItem)`,
        ),
      },
    )
    expect(ids(container)).toEqual(expected)
  })

  // the branch the server did not render is mounted, not hydrated
  const recovered = (content: string) =>
    `<main data-allow-mismatch="children">
      <section v-if="client">${content}</section>
      <article v-else>${content}</article>
    </main>`

  test('vdom slot content mounted on a mismatch', async () => {
    const { container } = await testHydration(
      `<script setup>const components = _components</script>
      <template>
        <components.Group>
          <components.VdomItem />
          <components.VdomItem />
        </components.Group>
        <components.VdomItem />
      </template>`,
      {
        VdomItem,
        Group: group(recovered(`<slot />`), `const client = _data`),
      },
      true,
      { isVaporApp: false, interop: true, serverData: false },
    )
    expect(ids(container)).toEqual(expected)
  })

  test('vnode mounted on a mismatch', async () => {
    const { container } = await testHydration(
      `<template>
        <components.Group />
        <components.VaporItem />
      </template>`,
      {
        VaporItem,
        VdomItem,
        Group: group(
          recovered(`<component :is="vnode" /><components.VaporItem />`),
          `const client = _data
          const vnode = h(components.VdomItem)`,
        ),
      },
      true,
      { isVaporApp: true, interop: true, serverData: false },
    )
    expect(ids(container)).toEqual(expected)
  })

  // what a vdom slot calls counts with the component that passed it
  const outlets = group(`<slot name="first" /><slot name="second" />`)
  const author = (slots: string) => `<script setup>
      import { useId } from 'vue'
      const components = _components
      const data = _data
    </script>
    <template>
      <components.Group>${slots}</components.Group>
    </template>`

  test('useId called by the content of two vdom slots', async () => {
    const { container } = await testWithVDOMApp(
      author(
        `<template #first><b :id="useId()" /></template>
        <template #second><i :id="useId()" /></template>`,
      ),
      { Group: outlets },
    )
    expect(ids(container)).toEqual(['v-0', 'v-1', 'v-2'])
  })

  test('useId called by vdom slot content after an empty outlet', async () => {
    const { container } = await testWithVDOMApp(
      author(`<template #second><i :id="useId()" /></template>`),
      { Group: outlets },
    )
    expect(ids(container)).toEqual(['v-0', 'v-1'])
  })

  test('useId called by the content of a conditional vdom slot', async () => {
    const { container } = await testWithVDOMApp(
      author(`<template v-if="data" #first><b :id="useId()" /></template>`),
      { Group: outlets },
      ref(true),
    )
    expect(ids(container)).toEqual(['v-0', 'v-1'])
  })
})

// the owner of a vapor slot is its author in a vdom component too
test('useId called by vapor slot content in a vdom component with onServerPrefetch', async () => {
  const { container } = await testWithVaporApp(
    `<script setup vapor>
      import { useId } from 'vue'
      const components = _components
    </script>
    <template>
      <components.Group>
        <template #first><b :id="useId()" /></template>
        <template #second><i :id="useId()" /></template>
      </components.Group>
    </template>`,
    {
      Item: `<script setup vapor>
        import { useId } from 'vue'
        const id = useId()
      </script>
      <template>
        <p :id="id" />
      </template>`,
      Group: {
        code: `<script setup>
          import { onServerPrefetch, useId } from 'vue'
          const components = _components
          onServerPrefetch(() => {})
          const id = useId()
        </script>
        <template>
          <div :id="id">
            <slot name="first" />
            <components.Item />
            <slot name="second" />
          </div>
        </template>`,
        vapor: false,
      },
    },
  )
  expect([...container.querySelectorAll('[id]')].map(el => el.id)).toEqual([
    'v-0',
    'v-1',
    'v-0-0',
    'v-2',
  ])
})
